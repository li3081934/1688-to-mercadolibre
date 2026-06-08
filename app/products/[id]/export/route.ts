import { NextResponse } from "next/server";

import { getProductById } from "@/lib/db";
import { exportProductWorkbook } from "@/lib/excel/export-product";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const product = getProductById(id);

  if (!product) {
    return NextResponse.json({ error: "商品不存在。" }, { status: 404 });
  }

  try {
    const requestUrl = new URL(request.url);
    const selectedSkuKeys = requestUrl.searchParams.getAll("sku").map((value) => value.trim()).filter(Boolean);
    const exported = await exportProductWorkbook(product, selectedSkuKeys);
    return new NextResponse(exported.buffer, {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(exported.fileName)}`
      }
    });
  } catch (error) {
    const url = new URL(`/products/${product.id}`, request.url);
    url.searchParams.set("status", "error");
    url.searchParams.set("message", error instanceof Error ? error.message : "导出失败。");
    return NextResponse.redirect(url, 302);
  }
}