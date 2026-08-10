import { NextResponse } from "next/server";

import { createMLUserProduct, getProductById, updateProduct } from "@/lib/db";
import { createUPItem, getMarketplaceUsers } from "@/lib/mercadolibre/client";
import {
  buildAvailableQuantity,
  buildFamilyName,
  buildItemPrice,
  buildSitesToSell,
  buildSaleTerms,
  buildUPAttributes,
  getPicturesArray,
} from "@/lib/mercadolibre/mapper";
import { getValidToken } from "@/lib/mercadolibre/token";
import { parseProductBundle } from "@/lib/products";

export const runtime = "nodejs";

type SkuOverride = {
  skuKey: string;
  price?: number;
  quantity?: number;
  pictureIds: string[];
  attributes?: Array<{ id: string; value_name: string; value_id?: string }>;
  warrantyTypeId?: string;
  warrantyTime?: string;
  listingTypeId?: "gold_special" | "gold_pro";
};

type PublishRequestBody = {
  productId: string;
  mlCategoryId: string;
  sites?: string[];
  familyName?: string;
  description?: string;
  skus?: SkuOverride[];
};

export async function POST(request: Request) {
  try {
    const body: PublishRequestBody = await request.json();
    const { productId, mlCategoryId, familyName: bodyFamilyName, description, skus = [] } = body;

    if (!productId || !mlCategoryId) {
      return NextResponse.json(
        { success: false, message: "缺少必填参数：productId 和 mlCategoryId。" },
        { status: 400 }
      );
    }

    const { token, mlUserId } = await getValidToken();

    const product = getProductById(productId);
    if (!product) {
      return NextResponse.json(
        { success: false, message: "商品不存在。" },
        { status: 404 }
      );
    }

    const bundle = await parseProductBundle(product.extractedDir);

    let targetMarketplaces: string[] = [];
    try {
      const marketplaceData = await getMarketplaceUsers(token, mlUserId);
      targetMarketplaces = marketplaceData.marketplaces
        .filter((m) => m.logistic_type !== "fulfillment")
        .map((m) => m.site_id);
    } catch {
      // 测试账号可能无法调用 Global Selling API，使用前端传入的站点
    }
    if (body.sites && body.sites.length > 0) {
      const selected = new Set(body.sites);
      targetMarketplaces = targetMarketplaces.filter((s) => selected.has(s));
      // 如果没有有效的市场数据，直接用前端传入的站点
      if (targetMarketplaces.length === 0) {
        targetMarketplaces = body.sites;
      }
    }

    const skuOverrideMap = new Map(skus.map((s) => [s.skuKey, s]));
    const results: Array<{
      skuKey: string;
      skuLabel: string;
      success: boolean;
      mlItemId?: string;
      sitelessUserProductId?: string;
      familyId?: string;
      error?: string;
    }> = [];

    const requestedKeys = new Set(skus.map((s) => s.skuKey));
    const skuItemsToPublish = (bundle.skuItems.length > 0 ? bundle.skuItems : [{ key: "main", skuId: product.offerId, label: product.title, product: bundle.mainProduct }])
      .filter((item) => requestedKeys.size === 0 || requestedKeys.has(item.key));

    const autoFamilyName = buildFamilyName(bundle.mainProduct, product.title);
    const familyName = bodyFamilyName?.trim() || autoFamilyName;
    const globalDescription = description?.trim() ?? "";

    for (const skuItem of skuItemsToPublish) {
      const override = skuOverrideMap.get(skuItem.key);

      // UP 模式: 使用 family_name, 图片只用 id, 无 variations
      const skuQty = override?.quantity ?? buildAvailableQuantity(bundle.mainProduct, [skuItem.product]);
      const skuPrice = override?.price ?? buildItemPrice(skuItem.product);

      const skuPictures = override?.pictureIds?.length
        ? override.pictureIds.map((id) => ({ id }))
        : [];
      if (skuPictures.length === 0) {
        results.push({
          skuKey: skuItem.key,
          skuLabel: skuItem.label,
          success: false,
          error: "UP 模式下图片必须通过 upload-image 先上传获取 ID，请先上传图片。",
        });
        continue;
      }

      const skuAttributes = (override?.attributes && override.attributes.length > 0)
        ? override.attributes
        : buildUPAttributes(skuItem.product, skuItem.skuId);
      if (!skuAttributes.find((a) => a.id === "ITEM_CONDITION")) {
        skuAttributes.unshift({
          id: "ITEM_CONDITION",
          values: [{ id: "2230284", name: "New" }],
        });
      }

      const saleTerms = buildSaleTerms(override?.warrantyTypeId, override?.warrantyTime);
      const sitesToSell = buildSitesToSell(targetMarketplaces, override?.listingTypeId);

      const sitesToSellWithPrice = sitesToSell.map((s) => ({
        ...s,
        net_proceeds: skuPrice,
      }));

      const itemPayload = {
        sites_to_sell: sitesToSellWithPrice,
        family_name: familyName,
        category_id: mlCategoryId,
        available_quantity: skuQty,
        pictures: skuPictures,
        attributes: skuAttributes,
        sale_terms: saleTerms,
        description: {
          plain_text: globalDescription,
        },
      };

      try {
        const createdItem = await createUPItem(token, itemPayload);
        results.push({
          skuKey: skuItem.key,
          skuLabel: skuItem.label,
          success: true,
          mlItemId: createdItem.item_id,
          sitelessUserProductId: createdItem.siteless_user_product_id,
          familyId: createdItem.siteless_family_id?.toString(),
        });

        createMLUserProduct({
          productId,
          skuKey: skuItem.key,
          sitelessUserProductId: createdItem.siteless_user_product_id || null,
          familyId: createdItem.siteless_family_id?.toString() || null,
          familyName,
          cbtItemId: createdItem.item_id || null,
          siteItems: JSON.stringify(createdItem.site_items || []),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "UP 刊登失败";
        results.push({
          skuKey: skuItem.key,
          skuLabel: skuItem.label,
          success: false,
          error: msg,
        });
      }
    }

    const successResults = results.filter((r) => r.success);
    if (successResults.length > 0) {
      const firstUP = results.find((r) => r.sitelessUserProductId);
      updateProduct(productId, {
        mlItemId: successResults.map((r) => r.mlItemId).join(","),
        isListed: 1,
        status: successResults.length === results.length ? "listed" : "partial",
        publishModel: "user_product",
        familyName,
        userProductId: firstUP?.sitelessUserProductId || null,
        familyId: firstUP?.familyId || null,
        lastError: successResults.length < results.length
          ? `${results.length - successResults.length} 个 SKU 刊登失败`
          : null,
      });
    }

    return NextResponse.json({
      success: successResults.length > 0,
      publishModel: "user_product",
      data: {
        total: results.length,
        succeeded: successResults.length,
        failed: results.length - successResults.length,
        results,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "刊登商品失败。";
    try {
      const body: PublishRequestBody = await request.clone().json();
      if (body.productId) {
        updateProduct(body.productId, { lastError: message });
      }
    } catch {
    }
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
