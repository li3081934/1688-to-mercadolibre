import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import {
  createMLUserProduct,
  getProductById,
  updateProduct,
  upsertMLPublishedProductMapping,
} from "@/lib/db";
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
  siteConfigs: Record<string, { price?: number; quantity?: number }>;
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

    if (targetMarketplaces.length === 0) {
      return NextResponse.json(
        { success: false, message: "至少选择一个有效的发布站点。" },
        { status: 400 },
      );
    }

    const skuOverrideMap = new Map(skus.map((s) => [s.skuKey, s]));
    const results: Array<{
      skuKey: string;
      skuLabel: string;
      success: boolean;
      partial?: boolean;
      mlItemId?: string;
      sitelessUserProductId?: string;
      familyId?: string;
      error?: string;
    }> = [];

    const requestedKeys = new Set(skus.map((s) => s.skuKey));
    const skuItemsToPublish = (bundle.skuItems.length > 0 ? bundle.skuItems : [{ key: "main", skuId: product.offerId, label: product.title, product: bundle.mainProduct }])
      .filter((item) => requestedKeys.size === 0 || requestedKeys.has(item.key));

    if (skuItemsToPublish.length === 0) {
      return NextResponse.json(
        { success: false, message: "至少选择一个要发布的 SKU。" },
        { status: 400 },
      );
    }

    const autoFamilyName = buildFamilyName(bundle.mainProduct, product.title);
    const familyName = bodyFamilyName?.trim() || autoFamilyName;
    const globalDescription = description?.trim() ?? "";

    for (const skuItem of skuItemsToPublish) {
      const override = skuOverrideMap.get(skuItem.key);
      const generatedSku = `MER${randomUUID().replace(/-/g, "").slice(0, 8)}`;

      // UP 模式: 使用 family_name, 图片只用 id, 无 variations
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
      const requestAttributes = skuAttributes.filter((attribute) => attribute.id !== "SELLER_SKU");
      if (!requestAttributes.find((a) => a.id === "ITEM_CONDITION")) {
        requestAttributes.unshift({
          id: "ITEM_CONDITION",
          values: [{ id: "2230284", name: "New" }],
        });
      }
      requestAttributes.push({ id: "SELLER_SKU", value_name: generatedSku });

      const siteConfigs = override?.siteConfigs || {};
      const missingConfig = targetMarketplaces.find((siteId) => {
        const config = siteConfigs[siteId];
        return !config || !Number.isFinite(config.price) || (config.price ?? 0) <= 0 || !Number.isInteger(config.quantity) || (config.quantity ?? 0) <= 0;
      });
      if (missingConfig) {
        results.push({
          skuKey: skuItem.key,
          skuLabel: skuItem.label,
          success: false,
          error: `站点 ${missingConfig} 缺少有效的价格或库存配置。`,
        });
        continue;
      }

      const quantities = targetMarketplaces.map((siteId) => siteConfigs[siteId]!.quantity as number);
      const sharedQuantity = quantities[0];
      if (quantities.some((quantity) => quantity !== sharedQuantity)) {
        results.push({
          skuKey: skuItem.key,
          skuLabel: skuItem.label,
          success: false,
          error: "该 SKU 的库存是跨站点共享的，所有站点必须使用相同库存。",
        });
        continue;
      }

      const sitesToSell = buildSitesToSell(targetMarketplaces, override?.listingTypeId).map((site) => ({
        ...site,
        net_proceeds: siteConfigs[site.site_id]!.price as number,
      }));
      const itemPayload = {
        sites_to_sell: sitesToSell,
        family_name: familyName,
        category_id: mlCategoryId,
        available_quantity: sharedQuantity,
        pictures: skuPictures,
        attributes: requestAttributes,
        sale_terms: buildSaleTerms(override?.warrantyTypeId, override?.warrantyTime),
        description: { plain_text: globalDescription },
      };

      let createdItem: Awaited<ReturnType<typeof createUPItem>> | null = null;
      let publishError: string | undefined;
      try {
        createdItem = await createUPItem(token, itemPayload);
      } catch (err) {
        publishError = err instanceof Error ? err.message : "UP 刊登失败";
      }

      const siteResults = createdItem?.site_items || [];
      const successfulSiteItems = siteResults.filter((site) => site.item_id && !site.error);
      const siteErrors = siteResults
        .filter((site) => !site.item_id || site.error)
        .map((site) => `[${site.site_id}] ${site.error?.error || site.error?.message || "接口未返回商品 ID"}`);
      const successful = successfulSiteItems.length > 0;
      results.push({
        skuKey: skuItem.key,
        skuLabel: skuItem.label,
        success: successful,
        partial: successful && siteErrors.length > 0,
        mlItemId: createdItem?.item_id,
        sitelessUserProductId: createdItem?.siteless_user_product_id,
        familyId: createdItem?.siteless_family_id?.toString(),
        error: publishError || (siteErrors.length > 0 ? siteErrors.join("; ") : undefined),
      });

      if (createdItem && successful) {
        const now = new Date().toISOString();
        createMLUserProduct({
          productId,
          skuKey: skuItem.key,
          sitelessUserProductId: createdItem.siteless_user_product_id || null,
          familyId: createdItem.siteless_family_id?.toString() || null,
          familyName,
          cbtItemId: createdItem.item_id || null,
          siteItems: JSON.stringify(siteResults),
          createdAt: now,
          updatedAt: now,
        });
        upsertMLPublishedProductMapping({
          productId,
          skuKey: skuItem.key,
          sourceSku: skuItem.skuId,
          sellerSku: generatedSku,
          sitelessUserProductId: createdItem.siteless_user_product_id || null,
          cbtItemId: createdItem.item_id || null,
          parentUserProductId: createdItem.parent_user_product_id || null,
          familyId: createdItem.siteless_family_id?.toString() || null,
          siteItems: JSON.stringify(siteResults),
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const successResults = results.filter((r) => r.success);
    const partialResults = results.filter((r) => r.partial);
    if (successResults.length > 0) {
      const firstUP = results.find((r) => r.sitelessUserProductId);
      updateProduct(productId, {
        mlItemId: successResults
          .map((r) => r.mlItemId)
          .filter((id): id is string => Boolean(id))
          .join(","),
        isListed: 1,
        status: successResults.length === results.length && partialResults.length === 0 ? "listed" : "partial",
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
