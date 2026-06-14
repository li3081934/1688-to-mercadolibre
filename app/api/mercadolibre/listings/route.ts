import { NextResponse } from "next/server";

import { getProductById, updateProduct } from "@/lib/db";
import { createItem } from "@/lib/mercadolibre/client";
import {
  buildItemTitle,
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

type ListItemRequestBody = {
  productId: string;
  mlCategoryId: string;
  title?: string;
  price?: number;
  description?: string;
};

export async function POST(request: Request) {
  try {
    const body: ListItemRequestBody = await request.json();
    const { productId, mlCategoryId } = body;

    // --- 1. 校验必填参数 ---
    if (!productId || !mlCategoryId) {
      return NextResponse.json(
        { success: false, message: "缺少必填参数：productId 和 mlCategoryId。" },
        { status: 400 }
      );
    }

    // --- 2. 获取有效 token ---
    const { token } = await getValidToken();

    // --- 3. 加载商品 ---
    const product = getProductById(productId);
    if (!product) {
      return NextResponse.json(
        { success: false, message: "商品不存在。" },
        { status: 404 }
      );
    }

    // --- 4. 解析 ZIP 数据 ---
    const bundle = await parseProductBundle(product.extractedDir);

    // --- 5. 构建 Global Selling Item 请求 ---
    const title = buildItemTitle(bundle.mainProduct, body.title);
    const price = buildItemPrice(bundle.mainProduct, body.price);
    const availableQuantity = buildAvailableQuantity(bundle.mainProduct, bundle.skuProducts);
    const pictures = getPicturesArray(bundle.mainProduct);
    const sitesToSell = buildSitesToSell([]);
    const attributes = buildAttributes(bundle.mainProduct, product.offerId);
    const saleTerms = buildSaleTerms();
    const descriptionText = body.description?.trim() || buildItemDescription(bundle.mainProduct);

    const itemPayload = {
      sites_to_sell: sitesToSell,
      currency_id: "USD" as const,
      catalog_listing: false,
      category_id: mlCategoryId,
      title,
      price,
      available_quantity: availableQuantity,
      condition: "new" as const,
      pictures,
      attributes,
      sale_terms: saleTerms,
      description: {
        plain_text: descriptionText,
      },
    };

    // --- 6. 创建商品刊登 ---
    const createdItem = await createItem(token, itemPayload);

    // --- 7. 更新数据库 ---
    updateProduct(productId, {
      mlItemId: createdItem.item_id,
      isListed: 1,
      status: "listed",
    });

    // --- 8. 返回成功 ---
    return NextResponse.json({
      success: true,
      data: {
        mlItemId: createdItem.item_id,
        siteItems: createdItem.site_items,
        title,
        price,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "刊登商品失败。";

    // 如果已知 productId，更新错误记录
    try {
      const body: ListItemRequestBody = await request.clone().json();
      if (body.productId) {
        updateProduct(body.productId, { lastError: message });
      }
    } catch {
      // ignore — body may not be parseable
    }

    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}