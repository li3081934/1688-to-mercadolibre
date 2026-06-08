import path from "node:path";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { createProduct, getCategoryById } from "@/lib/db";
import { parseProductBundle } from "@/lib/products";
import { getProductDir, removeDirectory, replaceFormFile } from "@/lib/storage";
import { extractZipArchive } from "@/lib/zip";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const categoryId = String(formData.get("categoryId") || "").trim();
  const zipFile = formData.get("zipFile");

  if (!categoryId) {
    return redirectWithMessage(request, "/products", "error", "上传商品时必须先选择分类。");
  }

  if (!(zipFile instanceof File) || zipFile.size === 0) {
    return redirectWithMessage(request, "/products", "error", "请上传 ZIP 文件。");
  }

  const category = getCategoryById(categoryId);
  if (!category) {
    return redirectWithMessage(request, "/products", "error", "所选分类不存在。");
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
    const now = new Date().toISOString();
    createProduct({
      id: productId,
      categoryId,
      title: String(source.title || "未命名商品"),
      offerId: String(source.offerId || source.url || productId),
      zipPath,
      extractedDir,
      mainJsonPath: bundle.mainJsonPath,
      skuCount: bundle.skuCount,
      isListed: 0,
      status: "ready",
      lastError: null,
      lastExportedAt: null,
      createdAt: now,
      updatedAt: now
    });

    return redirectWithMessage(request, "/products", "success", "商品 ZIP 已上传并解压。");
  } catch (error) {
    await removeDirectory(productDir);
    return redirectWithMessage(
      request,
      "/products",
      "error",
      error instanceof Error ? error.message : "上传 ZIP 失败。"
    );
  }
}

function redirectWithMessage(request: Request, routePath: string, status: string, message: string) {
  const url = new URL(routePath, request.url);
  url.searchParams.set("status", status);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url, { status: 303 });
}