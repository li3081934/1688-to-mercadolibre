import path from "node:path";

import { NextResponse } from "next/server";

import { deleteProduct, getProductById } from "@/lib/db";
import { removeDirectory } from "@/lib/storage";
import { redirectWithMessage } from "@/lib/url";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const product = getProductById(id);
  if (!product) {
    return NextResponse.json({ error: "商品不存在。" }, { status: 404 });
  }
  return NextResponse.json(product);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const product = getProductById(id);

  if (!product) {
    return NextResponse.json({ error: "商品不存在。" }, { status: 404 });
  }

  deleteProduct(id);
  await removeDirectory(path.dirname(product.zipPath));

  return NextResponse.json({ success: true, message: "商品已删除。" });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const product = getProductById(id);

  if (!product) {
    return redirectWithMessage(request, "/products", "error", "商品不存在。");
  }

  const formData = await request.formData();
  if (String(formData.get("_method") || "").toLowerCase() !== "delete") {
    return redirectWithMessage(request, "/products", "error", "不支持的商品操作。");
  }

  deleteProduct(id);
  await removeDirectory(path.dirname(product.zipPath));

  return redirectWithMessage(request, "/products", "success", "商品已删除。");
}

