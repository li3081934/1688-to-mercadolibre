import { NextResponse } from "next/server";

import { getProductById, updateProduct } from "@/lib/db";

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
  const nextIsListed = String(formData.get("isListed") || "0") === "1" ? 1 : 0;

  updateProduct(id, {
    isListed: nextIsListed
  });

  return redirectWithMessage(request, "/products", "success", "商品状态已更新。");
}

function redirectWithMessage(request: Request, routePath: string, status: string, message: string) {
  const url = new URL(routePath, request.url);
  url.searchParams.set("status", status);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url, { status: 303 });
}