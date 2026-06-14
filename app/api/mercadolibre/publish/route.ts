import { NextResponse } from "next/server";

import { getProductById, updateProduct } from "@/lib/db";
import { createItem, getMarketplaceUsers } from "@/lib/mercadolibre/client";
import {
  buildItemDescription,
  buildItemPrice,
  buildAvailableQuantity,
  getPicturesArray,
  buildSitesToSell,
  buildAttributes,
  buildSaleTerms,
} from "@/lib/mercadolibre/mapper";
import { getValidToken } from "@/lib/mercadolibre/token";
import { parseProductBundle } from "@/lib/products";

export const runtime = "nodejs";

type SkuOverride = {
  skuKey: string;
  title?: string;
  description?: string;
  price?: number;
  quantity?: number;
  pictureIds: string[];
  attributes?: Array<{ id: string; value_name: string }>;
  warrantyTypeId?: string;
  warrantyTime?: string;
  listingTypeId?: "gold_special" | "gold_pro";
};

type PublishRequestBody = {
  productId: string;
  mlCategoryId: string;
  sites?: string[];
  skus?: SkuOverride[];
};

export async function POST(request: Request) {
  try {
    const body: PublishRequestBody = await request.json();
    const { productId, mlCategoryId, skus = [] } = body;

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

    const marketplaceData = await getMarketplaceUsers(token, mlUserId);
    let targetMarketplaces = marketplaceData.marketplaces
      .filter((m) => m.logistic_type !== "fulfillment")
      .map((m) => m.site_id);
    if (body.sites && body.sites.length > 0) {
      const selected = new Set(body.sites);
      targetMarketplaces = targetMarketplaces.filter((s) => selected.has(s));
    }

    const basePictures = getPicturesArray(bundle.mainProduct);

    const skuOverrideMap = new Map(skus.map((s) => [s.skuKey, s]));
    const results: Array<{
      skuKey: string;
      skuLabel: string;
      success: boolean;
      mlItemId?: string;
      error?: string;
    }> = [];

    const requestedKeys = new Set(skus.map((s) => s.skuKey));
    const skuItemsToPublish = (bundle.skuItems.length > 0 ? bundle.skuItems : [{ key: "main", skuId: product.offerId, label: product.title, product: bundle.mainProduct }])
      .filter((item) => requestedKeys.size === 0 || requestedKeys.has(item.key));

    const familyName = bundle.mainProduct.product?.title?.trim().slice(0, 60) || product.title;

    for (const skuItem of skuItemsToPublish) {
      const override = skuOverrideMap.get(skuItem.key);
      const skuTitle = override?.title || `${familyName} - ${skuItem.label}`;
      const skuPrice = override?.price ?? buildItemPrice(skuItem.product);
      const skuQty = override?.quantity ?? buildAvailableQuantity(bundle.mainProduct, [skuItem.product]);
      const skuPictures = override?.pictureIds?.length
        ? override.pictureIds.map((id) => ({ id }))
        : basePictures;
      const skuAttributes = (override?.attributes && override.attributes.length > 0)
        ? override.attributes
        : buildAttributes(skuItem.product, skuItem.skuId);
      const skuDescription = override?.description?.trim() || buildItemDescription(bundle.mainProduct);

      const saleTerms = buildSaleTerms(override?.warrantyTypeId, override?.warrantyTime);
      const sitesToSell = buildSitesToSell(targetMarketplaces, override?.listingTypeId);

      const itemPayload = {
        sites_to_sell: sitesToSell,
        currency_id: "USD" as const,
        catalog_listing: false,
        category_id: mlCategoryId,
        title: skuTitle.trim().slice(0, 60),
        price: skuPrice,
        available_quantity: skuQty,
        condition: "new" as const,
        pictures: skuPictures,
        attributes: skuAttributes,
        sale_terms: saleTerms,
        description: {
          plain_text: skuDescription,
        },
      };

      try {
        const createdItem = await createItem(token, itemPayload);
        results.push({
          skuKey: skuItem.key,
          skuLabel: skuItem.label,
          success: true,
          mlItemId: createdItem.item_id,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "刊登失败";
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
      updateProduct(productId, {
        mlItemId: successResults.map((r) => r.mlItemId).join(","),
        isListed: 1,
        status: successResults.length === results.length ? "listed" : "partial",
        lastError: successResults.length < results.length
          ? `${results.length - successResults.length} 个 SKU 刊登失败`
          : null,
      });
    }

    return NextResponse.json({
      success: successResults.length > 0,
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
