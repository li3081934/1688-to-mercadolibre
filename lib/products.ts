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
  const skuId = normalizeText(product.sku?.skuId || source.skuId || fields.sku || path.basename(filePath, path.extname(filePath)) || `sku-${index + 1}`);
  return skuId || `sku-${index + 1}`;
}

function buildSkuLabel(product: ExportJsonRecord, filePath: string, index: number) {
  const source = product.source || {};
  const fields = product.fields || {};
  const variantOptions = Array.isArray(product.sku?.options)
    ? product.sku.options.map((item) => normalizeText(item)).filter(Boolean)
    : Array.isArray(source.variantOptions)
    ? source.variantOptions.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  const specAttrs = normalizeText(product.sku?.specAttrs || source.specAttrs);
  const skuCode = normalizeText(product.sku?.skuId || fields.sku || source.skuId);
  const title = normalizeText(product.product?.title || fields.title || source.title);
  const primary = variantOptions.join(" / ") || specAttrs || title || `SKU ${index + 1}`;

  return skuCode ? `${primary} (${skuCode})` : primary;
}

function buildSkuImageUrl(product: ExportJsonRecord) {
  const skuImages = Array.isArray(product.sku?.images)
    ? product.sku.images.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  if (skuImages.length) {
    return skuImages[0] || null;
  }

  const productImages = Array.isArray(product.product?.images)
    ? product.product.images.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  if (productImages.length) {
    return productImages[0] || null;
  }

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

function buildSyntheticSkuProduct(mainProduct: ExportJsonRecord, skuPackage: NonNullable<ExportJsonRecord["skuPackages"]>[number]): ExportJsonRecord {
  return {
    generatedAt: mainProduct.generatedAt,
    source: mainProduct.source,
    product: mainProduct.product,
    attributes: mainProduct.attributes,
    packageInfo: mainProduct.packageInfo,
    detail: mainProduct.detail,
    collectionWarnings: mainProduct.collectionWarnings,
    sku: {
      skuId: normalizeText(skuPackage?.skuId),
      specId: normalizeText(skuPackage?.specId),
      specAttrs: normalizeText(skuPackage?.specAttrs),
      options: Array.isArray(skuPackage?.options) ? skuPackage.options.map((item) => normalizeText(item)).filter(Boolean) : [],
      price: normalizeText(skuPackage?.price),
      stock: normalizeText(skuPackage?.stock),
      images: Array.isArray(skuPackage?.images) ? skuPackage.images.map((item) => normalizeText(item)).filter(Boolean) : [],
      packageInfo: skuPackage?.packageInfo
    }
  };
}

async function loadBundleDetail(bundleRoot: string) {
  const detailJsonPath = path.join(bundleRoot, "detail", "detail.json");
  if (!(await pathExists(detailJsonPath))) {
    return {
      detailJsonPath: null,
      detail: null
    };
  }

  return {
    detailJsonPath,
    detail: await loadJsonFile<NonNullable<ExportJsonRecord["detail"]>>(detailJsonPath)
  };
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
  const { detailJsonPath, detail } = await loadBundleDetail(bundleRoot);
  const loadedMainProduct = await loadJsonFile<ExportJsonRecord>(mainJsonPath);
  const mainProduct = loadedMainProduct.detail || !detail
    ? loadedMainProduct
    : {
        ...loadedMainProduct,
        detail
      };
  const skuRoot = path.join(bundleRoot, "skus");
  const sharedImagesDir = (await pathExists(path.join(bundleRoot, "shared-images", "images")))
    ? path.join(bundleRoot, "shared-images", "images")
    : null;
  const sharedImagePaths = sharedImagesDir ? await walkFiles(sharedImagesDir) : [];
  const skuJsonPaths = (await pathExists(skuRoot))
    ? (await walkFiles(skuRoot)).filter((filePath) => filePath.toLowerCase().endsWith(".json"))
    : [];
  const skuProducts = skuJsonPaths.length
    ? await Promise.all(skuJsonPaths.map((filePath) => loadJsonFile<ExportJsonRecord>(filePath)))
    : Array.isArray(mainProduct.skuPackages)
    ? mainProduct.skuPackages.map((skuPackage) => buildSyntheticSkuProduct(mainProduct, skuPackage))
    : [];
  const effectiveSkuJsonPaths = skuJsonPaths.length
    ? skuJsonPaths
    : skuProducts.map((product, index) => `${mainJsonPath}#sku-${buildSkuKey(product, mainJsonPath, index)}`);
  const skuItems: ParsedSkuItem[] = skuProducts.map((product, index) => ({
    key: buildSkuKey(product, effectiveSkuJsonPaths[index], index),
    skuId: normalizeText(product.sku?.skuId || product.source?.skuId || product.fields?.sku || `SKU-${index + 1}`),
    label: buildSkuLabel(product, effectiveSkuJsonPaths[index], index),
    imageUrl: buildSkuImageUrl(product),
    jsonPath: skuJsonPaths[index] || null,
    product
  }));

  return {
    mainJsonPath,
    mainProduct,
    detailJsonPath,
    skuJsonPaths: effectiveSkuJsonPaths,
    skuProducts,
    skuItems,
    skuCount: skuProducts.length,
    sharedImagesDir,
    sharedImagePaths
  };
}