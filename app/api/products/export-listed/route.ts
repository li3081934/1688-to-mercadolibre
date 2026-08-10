import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { getValidToken } from "@/lib/mercadolibre/token";
import { getMLAccount } from "@/lib/db";

export const runtime = "nodejs";

const API_BASE = "https://api.mercadolibre.com";

type MLItemDetail = {
  id: string;
  title: string;
  price: number;
  category_id: string;
  available_quantity: number;
  condition: string;
  listing_type_id: string;
  status: string;
};

async function mlFetch(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ML API 请求失败 (${res.status}): ${text}`);
  }
  return res.json();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category")?.trim();

  if (!category) {
    return NextResponse.json(
      { success: false, message: "请输入分类名称。" },
      { status: 400 }
    );
  }

  try {
    const account = getMLAccount();
    if (!account) {
      return NextResponse.json(
        { success: false, message: "未授权美客多账号。" },
        { status: 401 }
      );
    }

    const { token } = await getValidToken();

    // 1. 获取用户信息，拿到 merchant_id
    const user = await mlFetch(`${API_BASE}/marketplace/users/${account.mlUserId}`, token);
    const merchantId = user.user_id;

    // 2. 搜索该分类下的所有商品 ID
    const searchUrl = `${API_BASE}/marketplace/users/${merchantId}/items/search?category_id=${encodeURIComponent(category)}&search_type=scan`;
    const searchRes = await mlFetch(searchUrl, token);
    const itemIds = searchRes.results as string[];

    if (!itemIds.length) {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(category);
      sheet.columns = [{ header: "提示", key: "msg" }];
      sheet.addRow({ msg: "该分类下没有找到商品。" });
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = encodeURIComponent(`${category}-上架商品.xlsx`);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
        },
      });
    }

    // 3. 批量获取商品详情（每次最多 20 个）
    const details: MLItemDetail[] = [];
    for (let i = 0; i < itemIds.length; i += 20) {
      const batch = itemIds.slice(i, i + 20);
      const idsParam = batch.join(",");
      const multigetRes = await mlFetch(
        `${API_BASE}/items?ids=${idsParam}&attributes=id,title,price,category_id,available_quantity,condition,listing_type_id,status`,
        token
      );
      for (const item of multigetRes as Array<{ code: number; body: MLItemDetail }>) {
        if (item.code === 200 && item.body) {
          details.push(item.body);
        }
      }
    }

    // 4. 生成 Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(category.slice(0, 31));

    sheet.columns = [
      { header: "序号", key: "idx", width: 8 },
      { header: "商品标题", key: "title", width: 50 },
      { header: "ML Item ID", key: "id", width: 24 },
      { header: "分类 ID", key: "category_id", width: 16 },
      { header: "价格 (USD)", key: "price", width: 14 },
      { header: "库存", key: "quantity", width: 10 },
      { header: "状态", key: "status", width: 12 },
      { header: "刊登类型", key: "listing_type", width: 14 },
      { header: "成色", key: "condition", width: 14 },
    ];

    details.forEach((item, i) => {
      sheet.addRow({
        idx: i + 1,
        title: item.title,
        id: item.id,
        category_id: item.category_id,
        price: item.price,
        quantity: item.available_quantity,
        status: item.status,
        listing_type: item.listing_type_id,
        condition: item.condition,
      });
    });

    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = encodeURIComponent(`${category}-上架商品.xlsx`);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "导出失败。" },
      { status: 500 }
    );
  }
}
