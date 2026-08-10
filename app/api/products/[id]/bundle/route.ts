import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getProductById } from "@/lib/db";
import { parseProductBundle } from "@/lib/products";
import { walkFiles } from "@/lib/zip";

export const runtime = "nodejs";

const STORAGE_ROOT = path.join(process.cwd(), "storage");

type RouteContext = {
  params: Promise<{ id: string }>;
};

function buildLocalImageUrl(absolutePath: string): string {
  const relative = path.relative(STORAGE_ROOT, absolutePath).replace(/\\/g, "/");
  return `/api/storage/${relative}`;
}

async function findSkuImages(bundleRoot: string): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  const skuRoot = path.join(bundleRoot, "skus");
  try {
    await stat(skuRoot);
    const entries = await readdir(skuRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skuDir = path.join(skuRoot, entry.name);
      const imagesDir = path.join(skuDir, "images");
      try {
        await stat(imagesDir);
        const imageFiles = (await walkFiles(imagesDir)).filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
        result[entry.name] = imageFiles.map((p) => buildLocalImageUrl(p));
      } catch {
        result[entry.name] = [];
      }
    }
  } catch {
    // no skus directory
  }
  return result;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const product = getProductById(id);
  if (!product) {
    return NextResponse.json({ error: "商品不存在。" }, { status: 404 });
  }

  try {
    const bundle = await parseProductBundle(product.extractedDir);
    const bundleRoot = path.dirname(bundle.mainJsonPath);

    const perSkuImages = await findSkuImages(bundleRoot);
    const mainImagesDir = path.join(bundleRoot, "main-images");
    let mainImagePaths: string[] = [];
    try {
      await stat(mainImagesDir);
      mainImagePaths = (await walkFiles(mainImagesDir)).filter((filePath) => /\.(jpg|jpeg|png|webp|gif)$/i.test(filePath));
    } catch {
      // no main-images directory
    }

    const localImagePaths = Array.from(new Set([
      ...mainImagePaths,
      ...bundle.sharedImagePaths,
    ]));

    const skuLocalImages: Record<string, string[]> = {};
    for (const sku of bundle.skuItems) {
      const skuId = sku.skuId;
      const direct = perSkuImages[skuId] || [];
      skuLocalImages[sku.key] = direct.length > 0
        ? direct
        : localImagePaths.map((p) => buildLocalImageUrl(p));
    }

    const skuPackageInfo: Record<string, Record<string, string> | null> = {};
    for (let i = 0; i < bundle.skuItems.length; i++) {
      const pkg = bundle.skuProducts[i]?.sku?.packageInfo || null;
      if (pkg) {
        skuPackageInfo[bundle.skuItems[i].key] = pkg;
      }
    }

    return NextResponse.json({
      mainProduct: {
        product: bundle.mainProduct.product || null,
        source: bundle.mainProduct.source || null,
        attributes: bundle.mainProduct.attributes || null,
        packageInfo: bundle.mainProduct.packageInfo || null,
        detail: bundle.mainProduct.detail || null,
      },
      skuItems: bundle.skuItems.map((sku) => ({
        key: sku.key,
        skuId: sku.skuId,
        label: sku.label,
        imageUrl: sku.imageUrl,
      })),
      skuProducts: bundle.skuProducts,
      skuPackageInfo,
      localImages: localImagePaths.map((p) => buildLocalImageUrl(p)),
      skuLocalImages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "解析商品数据失败。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
