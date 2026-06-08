import path from "node:path";

import { NextResponse } from "next/server";

import { deleteProduct, getProductById } from "@/lib/db";
import { removeDirectory } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

function redirectWithMessage(request: Request, routePath: string, status: string, message: string) {
  const url = new URL(routePath, request.url);
  url.searchParams.set("status", status);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url, { status: 303 });
}