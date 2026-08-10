import type { ExportJsonRecord } from "@/lib/types";

/**
 * 解析商品价格（USD）
 */
export function buildItemPrice(
  mainProduct: ExportJsonRecord,
  overridePrice?: number
): number {
  if (overridePrice !== undefined && overridePrice > 0) {
    return overridePrice;
  }

  const priceStr =
    mainProduct.product?.price ||
    (mainProduct.fields?.price as string | undefined) ||
    (mainProduct.source?.price as string | undefined);

  if (!priceStr) {
    return 1;
  }

  const parsed = parseFloat(priceStr.replace(/[^0-9.]/g, ""));
  return parsed > 0 ? parsed : 1;
}

/**
 * 计算可用库存数量
 */
export function buildAvailableQuantity(
  _mainProduct: ExportJsonRecord,
  skuProducts: ExportJsonRecord[]
): number {
  if (skuProducts.length > 0) {
    let total = 0;
    for (const sku of skuProducts) {
      const stockStr =
        sku.sku?.stock ||
        (sku.fields?.stock as string | undefined) ||
        (sku.source?.stock as string | undefined);
      if (stockStr) {
        const parsed = parseInt(stockStr.replace(/[^0-9]/g, ""), 10);
        if (!isNaN(parsed) && parsed > 0) {
          total += parsed;
        }
      }
    }
    if (total > 0) return total;
  }

  return Math.max(skuProducts.length, 1);
}

/**
 * 构建图片数组
 * Global Selling 使用 source URL（不需要先上传）
 * 优先使用 product.images 中的 URL
 */
export function getPicturesArray(
  mainProduct: ExportJsonRecord,
  maxPictures = 10
): Array<{ source: string }> {
  const imageUrls: string[] = [];

  // 从 product.images 获取
  if (Array.isArray(mainProduct.product?.images)) {
    for (const img of mainProduct.product.images) {
      if (typeof img === "string" && img.trim()) {
        imageUrls.push(img.trim());
      }
    }
  }

  // 从 source 获取
  if (imageUrls.length === 0) {
    const source = mainProduct.source || {};
    const pictures = source.pictures as string | undefined;
    if (pictures) {
      const urls = String(pictures)
        .split(";")
        .map((u) => u.trim())
        .filter(Boolean);
      imageUrls.push(...urls);
    }
  }

  // 从 fields 获取
  if (imageUrls.length === 0) {
    const fields = mainProduct.fields || {};
    const pictures = fields.pictures as string | undefined;
    if (pictures) {
      const urls = String(pictures)
        .split(";")
        .map((u) => u.trim())
        .filter(Boolean);
      imageUrls.push(...urls);
    }
  }

  return imageUrls.slice(0, maxPictures).map((url) => ({ source: url }));
}

/**
 * 构建 sites_to_sell 数组
 */
export function buildSitesToSell(
  siteIds: string[],
  listingTypeId: "gold_special" | "gold_pro" = "gold_special"
): Array<{
  site_id: string;
  logistic_type: "remote";
  listing_type_id: "gold_special" | "gold_pro";
}> {
  return siteIds.map((siteId) => ({
    site_id: siteId,
    logistic_type: "remote" as const,
    listing_type_id: listingTypeId,
  }));
}

/**
 * 构建 family_name（UP 模式通用描述，不含具体变体信息）
 * 例如: "Apple iPhone 256GB" (不包含颜色)
 */
export function buildFamilyName(
  mainProduct: ExportJsonRecord,
  fallbackTitle: string
): string {
  const title =
    mainProduct.product?.title ||
    (mainProduct.fields?.title as string | undefined) ||
    (mainProduct.source?.title as string | undefined) ||
    fallbackTitle;

  return title.trim().slice(0, 60);
}

/**
 * 构建 UP 模式的 attributes（支持 values 数组格式）
 * 参考: https://global-selling.mercadolibre.com/devsite/price-per-variation-cbt
 */
export function buildUPAttributes(
  mainProduct: ExportJsonRecord,
  offerId: string
): Array<{ id: string } & ({ value_name: string } | { values: Array<{ id?: string; name: string }> })> {
  const attributes: Array<{ id: string } & ({ value_name: string } | { values: Array<{ id?: string; name: string }> })> = [];

  // ITEM_CONDITION — 用 values 数组格式
  attributes.push({
    id: "ITEM_CONDITION",
    values: [{ id: "2230284", name: "New" }],
  });

  // BRAND — 从商品属性中提取
  const brand = findAttribute(mainProduct, "品牌", "brand", "Brand");
  if (brand) {
    attributes.push({ id: "BRAND", value_name: brand });
  } else {
    attributes.push({ id: "BRAND", value_name: "Generic" });
  }

  // MODEL — 从商品属性中提取
  const model = findAttribute(mainProduct, "型号", "model", "Model");
  if (model) {
    attributes.push({ id: "MODEL", value_name: model });
  } else {
    attributes.push({ id: "MODEL", value_name: mainProduct.product?.title?.slice(0, 50) || "Standard" });
  }

  // SELLER_SKU
  attributes.push({ id: "SELLER_SKU", value_name: offerId || "SKU-001" });

  // GTIN — 可选，有则填
  const gtin = findAttribute(mainProduct, "GTIN", "ean", "upc", "barcode");
  if (gtin) {
    attributes.push({ id: "GTIN", value_name: gtin });
  }

  // 包装尺寸 — 从 SKU packageInfo 提取
  const skuPkg = mainProduct.sku?.packageInfo;
  if (skuPkg) {
    if (skuPkg.length) attributes.push({ id: "PACKAGE_LENGTH", value_name: `${skuPkg.length} cm` });
    if (skuPkg.width) attributes.push({ id: "PACKAGE_WIDTH", value_name: `${skuPkg.width} cm` });
    if (skuPkg.height) attributes.push({ id: "PACKAGE_HEIGHT", value_name: `${skuPkg.height} cm` });
    if (skuPkg.weight) {
      attributes.push({ id: "PACKAGE_WEIGHT", value_name: `${skuPkg.weight} g` });
    }
  }

  return attributes;
}

const WARRANTY_OPTIONS: Record<string, { value_id: string; value_name: string }> = {
  "6150835": { value_id: "6150835", value_name: "No warranty" },
  "2230279": { value_id: "2230279", value_name: "Factory warranty" },
  "2230278": { value_id: "2230278", value_name: "Seller warranty" },
};

export function buildSaleTerms(
  warrantyTypeId?: string,
  warrantyTime?: string
): Array<{
  id: string;
  value_id?: string;
  value_name: string;
}> {
  const type = warrantyTypeId ? WARRANTY_OPTIONS[warrantyTypeId] : WARRANTY_OPTIONS["6150835"];
  if (!type) {
    return [{ id: "WARRANTY_TYPE", value_id: "6150835", value_name: "No warranty" }];
  }

  const result: Array<{ id: string; value_id?: string; value_name: string }> = [
    { id: "WARRANTY_TYPE", value_id: type.value_id, value_name: type.value_name },
  ];

  if (type.value_id !== "6150835" && warrantyTime) {
    result.push({ id: "WARRANTY_TIME", value_name: warrantyTime });
  }

  return result;
}

/**
 * 从商品数据中查找属性值
 * 遍历 attributes 数组、fields、source 查找匹配的键
 */
function findAttribute(
  mainProduct: ExportJsonRecord,
  ...keys: string[]
): string | undefined {
  // 从 attributes 数组中查找
  if (Array.isArray(mainProduct.attributes)) {
    for (const attr of mainProduct.attributes) {
      if (keys.some((k) => attr.label.toLowerCase().includes(k.toLowerCase()))) {
        if (attr.value?.trim()) return attr.value.trim();
      }
    }
  }

  // 从 fields 中查找
  const fields = mainProduct.fields || {};
  for (const key of keys) {
    const val = fields[key.toLowerCase()] as string | undefined;
    if (val?.trim()) return val.trim();
  }

  // 从 source 中查找
  const source = mainProduct.source || {};
  for (const key of keys) {
    const val = source[key.toLowerCase()] as string | undefined;
    if (val?.trim()) return val.trim();
  }

  return undefined;
}