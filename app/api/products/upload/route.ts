import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { createProduct } from "@/lib/db";
import { parseProductBundle } from "@/lib/products";
import { getProductDir, removeDirectory, replaceFormFile } from "@/lib/storage";
import { extractZipArchive } from "@/lib/zip";
import { recommendProductCategory } from "@/lib/mercadolibre/product-category-recommendation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const zipFile = formData.get("zipFile");

  if (!(zipFile instanceof File) || zipFile.size === 0) {
    return NextResponse.json(
      { success: false, message: "请上传 ZIP 文件。" },
      { status: 400 }
    );
  }

  const productId = randomUUID();
  const productDir = getProductDir(productId);
  const zipPath = path.join(productDir, "source.zip");
  const extractedDir = path.join(productDir, "extracted");

  try {
    await replaceFormFile(zipFile, zipPath);
    await extractZipArchive(zipPath, extractedDir);

    const bundle = await parseProductBundle(extractedDir);
    const source = bundle.mainProduct.source || {};
    const productPayload = bundle.mainProduct.product || {};
    const now = new Date().toISOString();
    createProduct({
      id: productId,
      title: String(productPayload.title || source.title || "未命名商品"),
      offerId: String(productPayload.offerId || source.offerId || source.url || productId),
      zipPath,
      extractedDir,
      mainJsonPath: bundle.mainJsonPath,
      skuCount: bundle.skuCount,
      isListed: 0,
      status: "ready",
      lastError: null,
      lastExportedAt: null,
      mlItemId: null,
      mlCategoryId: null,
      familyName: null,
      userProductId: null,
      familyId: null,
      parentUserProductId: null,
      publishModel: "classic",
      createdAt: now,
      updatedAt: now
    });
    console.info(`[category-recommendation] upload created product=${productId}, starting background task`);
    void recommendProductCategory(productId).catch((error) => {
      console.error(`[category-recommendation] product=${productId} background task failed`, error);
    });

    return NextResponse.json(
      { success: true, message: "商品 ZIP 已上传并建档。" },
      { status: 200 }
    );
  } catch (error) {
    await removeDirectory(productDir);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "上传 ZIP 失败。" },
      { status: 500 }
    );
  }
}
