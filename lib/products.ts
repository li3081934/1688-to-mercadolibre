import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type { ExportJsonRecord, ParsedProductBundle, ParsedSkuItem } from "@/lib/types";
import { walkFiles } from "@/lib/zip";

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function loadJsonFile<T>(filePath: string) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function normalizeText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildSkuKey(product: ExportJsonRecord, filePath: string, index: number) {
  const source = product.source || {};
  const fields = product.fields || {};
  const skuId = normalizeText(source.skuId || fields.sku || path.basename(filePath, path.extname(filePath)) || `sku-${index + 1}`);
  return skuId || `sku-${index + 1}`;
}

function buildSkuLabel(product: ExportJsonRecord, filePath: string, index: number) {
  const source = product.source || {};
  const fields = product.fields || {};
  const variantOptions = Array.isArray(source.variantOptions)
    ? source.variantOptions.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  const specAttrs = normalizeText(source.specAttrs);
  const skuCode = normalizeText(fields.sku || source.skuId);
  const title = normalizeText(fields.title || source.title);
  const primary = variantOptions.join(" / ") || specAttrs || title || `SKU ${index + 1}`;

  return skuCode ? `${primary} (${skuCode})` : primary;
}

function buildSkuImageUrl(product: ExportJsonRecord) {
  const source = product.source || {};
  const fields = product.fields || {};
  const picturesValue = normalizeText(fields.pictures || source.pictures);

  if (!picturesValue) {
    return null;
  }

  const firstImage = picturesValue
    .split(";")
    .map((item) => normalizeText(item))
    .find(Boolean);

  return firstImage || null;
}

async function resolveBundleRoot(extractedDir: string) {
  let currentDir = extractedDir;

  for (let depth = 0; depth < 3; depth += 1) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    const hasRootJson = entries.some((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"));
    if (hasRootJson) {
      return currentDir;
    }

    const childDirectories = entries.filter((entry) => entry.isDirectory());
    if (childDirectories.length !== 1) {
      return currentDir;
    }

    currentDir = path.join(currentDir, childDirectories[0].name);
  }

  return currentDir;
}

export async function parseProductBundle(extractedDir: string): Promise<ParsedProductBundle> {
  const bundleRoot = await resolveBundleRoot(extractedDir);
  const rootEntries = await readdir(bundleRoot, { withFileTypes: true });
  const mainJsonEntry = rootEntries.find((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"));

  if (!mainJsonEntry) {
    throw new Error("ZIP 解压后未找到主商品 JSON。请确认压缩包结构正确。");
  }

  const mainJsonPath = path.join(bundleRoot, mainJsonEntry.name);
  const mainProduct = await loadJsonFile<ExportJsonRecord>(mainJsonPath);
  const skuRoot = path.join(bundleRoot, "skus");
  const sharedImagesDir = (await pathExists(path.join(bundleRoot, "shared-images", "images")))
    ? path.join(bundleRoot, "shared-images", "images")
    : null;
  const sharedImagePaths = sharedImagesDir ? await walkFiles(sharedImagesDir) : [];
  const skuJsonPaths = (await pathExists(skuRoot))
    ? (await walkFiles(skuRoot)).filter((filePath) => filePath.toLowerCase().endsWith(".json"))
    : [];
  const skuProducts = await Promise.all(skuJsonPaths.map((filePath) => loadJsonFile<ExportJsonRecord>(filePath)));
  const skuItems: ParsedSkuItem[] = skuProducts.map((product, index) => ({
    key: buildSkuKey(product, skuJsonPaths[index], index),
    skuId: normalizeText(product.source?.skuId || product.fields?.sku || `SKU-${index + 1}`),
    label: buildSkuLabel(product, skuJsonPaths[index], index),
    imageUrl: buildSkuImageUrl(product),
    jsonPath: skuJsonPaths[index],
    product
  }));

  return {
    mainJsonPath,
    mainProduct,
    skuJsonPaths,
    skuProducts,
    skuItems,
    skuCount: skuJsonPaths.length,
    sharedImagesDir,
    sharedImagePaths
  };
}