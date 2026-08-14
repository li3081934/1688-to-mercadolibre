import { rm } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getProductById } from "@/lib/db";
import { STORAGE_ROOT } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function resolveStoragePath(imageUrl: string) {
  if (!imageUrl.startsWith("/api/storage/")) return null;
  const relativePath = imageUrl.slice("/api/storage/".length).split("?")[0];
  return path.resolve(STORAGE_ROOT, ...relativePath.split("/").map(decodeURIComponent));
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const product = getProductById(id);
  if (!product) return NextResponse.json({ message: "商品不存在。" }, { status: 404 });

  try {
    const body = await request.json();
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
    const imagePath = resolveStoragePath(imageUrl);
    const productRoot = path.resolve(product.extractedDir);
    const relativeToProduct = imagePath ? path.relative(productRoot, imagePath) : "";

    if (
      !imagePath ||
      !IMAGE_EXTENSIONS.has(path.extname(imagePath).toLowerCase()) ||
      !relativeToProduct ||
      relativeToProduct.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeToProduct)
    ) {
      return NextResponse.json({ message: "图片路径无效。" }, { status: 400 });
    }

    await rm(imagePath, { force: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "删除图片失败。" },
      { status: 500 },
    );
  }
}