import { getProductById, updateProduct } from "@/lib/db";
import { recommendCategoryByTitle } from "@/lib/mercadolibre/category-recommendation";

const TASK_TIMEOUT_MS = 5 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("分类推荐超时，请检查 AI 模型服务是否可用。")), timeoutMs);
    }),
  ]);
}

async function runProductCategoryRecommendation(productId: string) {
  const product = getProductById(productId);
  if (!product) {
    console.warn(`[category-recommendation] product=${productId} not found before execution`);
    return;
  }

  console.info(`[category-recommendation] product=${productId} started`);

  updateProduct(productId, {
    status: "category_recommending",
    lastError: null,
  });

  try {
    const recommendation = await withTimeout(
      recommendCategoryByTitle(product.title),
      TASK_TIMEOUT_MS,
    );
    updateProduct(productId, {
      mlCategoryId: recommendation.categoryId,
      lastError: null,
    });
    console.info(
      `[category-recommendation] product=${productId} succeeded category=${recommendation.categoryId}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 推荐分类失败。";
    console.error(`[category-recommendation] product=${productId} failed: ${message}`);
    if (getProductById(productId)) {
      updateProduct(productId, { lastError: message });
    }
  } finally {
    if (getProductById(productId)) {
      updateProduct(productId, { status: "ready" });
    }
    console.info(`[category-recommendation] product=${productId} finished`);
  }
}

export function recommendProductCategory(productId: string) {
  console.info(`[category-recommendation] product=${productId} queued`);
  return runProductCategoryRecommendation(productId);
}