import type { ExportJsonRecord } from "@/lib/types";

/**
 * 从 HTML 中去除标签，提取纯文本
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 构建商品标题
 * Global Selling 标题限制 60 字符，建议英文
 */
export function buildItemTitle(
  mainProduct: ExportJsonRecord,
  overrideTitle?: string
): string {
  if (overrideTitle?.trim()) {
    return overrideTitle.trim().slice(0, 60);
  }

  const title =
    mainProduct.product?.title ||
    (mainProduct.fields?.title as string | undefined) ||
    (mainProduct.source?.title as string | undefined) ||
    "Product";

  return title.trim().slice(0, 60);
}

/**
 * 构建商品描述（纯文本）
 * Global Selling 描述内联在请求体中，纯文本格式
 */
export function buildItemDescription(mainProduct: ExportJsonRecord): string {
  if (mainProduct.detail?.text) {
    return stripHtml(mainProduct.detail.text);
  }

  if (mainProduct.detail?.html) {
    return stripHtml(mainProduct.detail.html);
  }

  if (mainProduct.product?.description) {
    return stripHtml(mainProduct.product.description);
  }

  return mainProduct.product?.title || "No description";
}

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
 * Global Selling 需要指定目标市场
 */
export function buildSitesToSell(
  siteIds: string[]
): Array<{
  site_id: string;
  logistic_type: "remote";
  listing_type_id: "gold_special" | "gold_pro";
}> {
  if (siteIds.length === 0) {
    // 默认发布到所有可用市场
    siteIds = ["MLB", "MLM", "MLC", "MCO"];
  }

  return siteIds.map((siteId) => ({
    site_id: siteId,
    logistic_type: "remote" as const,
    listing_type_id: "gold_special" as const,
  }));
}

/**
 * 构建 attributes 数组
 * Global Selling 需要以下必填属性：
 * - BRAND, GTIN, ITEM_CONDITION, MODEL
 * - PACKAGE_HEIGHT, PACKAGE_LENGTH, PACKAGE_WIDTH, PACKAGE_WEIGHT
 * - SELLER_SKU
 */
export function buildAttributes(
  mainProduct: ExportJsonRecord,
  offerId: string
): Array<{ id: string; value_name: string }> {
  const attributes: Array<{ id: string; value_name: string }> = [];

  // ITEM_CONDITION — 新品
  attributes.push({ id: "ITEM_CONDITION", value_name: "New" });

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
      attributes.push({ id: "PACKAGE_WEIGHT", value_name: `${skuPkg.weight} kg` });
    }
  }

  return attributes;
}

/**
 * 构建 sale_terms 数组
 * Global Selling 需要保修信息
 */
export function buildSaleTerms(): Array<{
  id: string;
  value_id?: string;
  value_name: string;
}> {
  return [
    {
      id: "WARRANTY_TYPE",
      value_id: "2230279",
      value_name: "Factory warranty",
    },
    {
      id: "WARRANTY_TIME",
      value_name: "30 days",
    },
  ];
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