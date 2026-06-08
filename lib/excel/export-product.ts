import path from "node:path";

import ExcelJS from "exceljs";

import { updateProduct } from "@/lib/db";
import { mapperHelpers, loadCategoryMapper } from "@/lib/mappers/load-category-mapper";
import { parseProductBundle } from "@/lib/products";
import type { ProductListItem } from "@/lib/types";

function buildDownloadFileName(product: ProductListItem) {
  const base = `${product.categoryCode}-${product.offerId || product.id}-${product.title || "product"}`
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

  return `${base || product.id}.xlsx`;
}

export async function exportProductWorkbook(product: ProductListItem, selectedSkuKeys?: string[]) {
  const bundle = await parseProductBundle(product.extractedDir);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(product.categoryTemplatePath);

  const selectedSkuSet = selectedSkuKeys?.length ? new Set(selectedSkuKeys) : null;
  const filteredSkuProducts = selectedSkuSet
    ? bundle.skuItems.filter((item) => selectedSkuSet.has(item.key)).map((item) => item.product)
    : bundle.skuProducts;

  if (bundle.skuItems.length > 0 && filteredSkuProducts.length === 0) {
    throw new Error("请至少选择一个 SKU 后再导出。");
  }

  try {
    const mapper = await loadCategoryMapper(product.categoryMapperPath);
    await mapper({
      workbook,
      category: {
        id: product.categoryId,
        code: product.categoryCode,
        name: product.categoryName,
        sheetName: product.categorySheetName,
        templatePath: product.categoryTemplatePath,
        mapperPath: product.categoryMapperPath,
        isActive: 1,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      },
      product,
      mainProduct: bundle.mainProduct,
      skuProducts: filteredSkuProducts,
      extractedDir: product.extractedDir,
      sharedImagesDir: bundle.sharedImagesDir,
      sharedImagePaths: bundle.sharedImagePaths,
      helpers: mapperHelpers
    });

    const buffer = await workbook.xlsx.writeBuffer();

    updateProduct(product.id, {
      lastError: null,
      lastExportedAt: new Date().toISOString(),
      status: "ready"
    });

    return {
      fileName: buildDownloadFileName(product),
      buffer: Buffer.from(buffer),
      templatePath: path.basename(product.categoryTemplatePath)
    };
  } catch (error) {
    updateProduct(product.id, {
      status: "error",
      lastError: error instanceof Error ? error.message : "导出失败。"
    });
    throw error;
  }
}