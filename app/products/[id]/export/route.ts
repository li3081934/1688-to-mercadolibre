import { NextResponse } from "next/server";

import { getProductById } from "@/lib/db";
import { exportProductWorkbook } from "@/lib/excel/export-product";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ExportRequestInput = {
  selectedSkuKeys: string[];
  userPrompt: string;
};

export async function GET(request: Request, context: RouteContext) {
  const requestUrl = new URL(request.url);
  return handleExport(request, context, {
    selectedSkuKeys: requestUrl.searchParams.getAll("sku").map((value) => value.trim()).filter(Boolean),
    userPrompt: requestUrl.searchParams.get("userPrompt")?.trim() || ""
  });
}

export async function POST(request: Request, context: RouteContext) {
  const formData = await request.formData();
  return handleExport(request, context, {
    selectedSkuKeys: formData.getAll("sku").map((value) => String(value || "").trim()).filter(Boolean),
    userPrompt: String(formData.get("userPrompt") || "").trim()
  });
}

async function handleExport(request: Request, context: RouteContext, input: ExportRequestInput) {
  const { id } = await context.params;
  const product = getProductById(id);

  if (!product) {
    return NextResponse.json({ error: "商品不存在。" }, { status: 404 });
  }

  try {
    const exported = await exportProductWorkbook(product, input);
    return new NextResponse(new Uint8Array(exported.buffer), {
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