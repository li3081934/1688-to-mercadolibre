import type { MLCategory, MLCategoryAttribute, MLCreateItemRequest, MLCreateItemResponse, MLPredictedCategory, MLSite } from "./types";

const API_BASE = "https://api.mercadolibre.com";

/**
 * 带 access_token 的 fetch 封装
 */
async function mlFetch(endpoint: string, accessToken: string, options?: RequestInit & { timeout?: number }) {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
  const timeout = options?.timeout ?? 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ML API 请求失败 (${res.status}): ${text}`);
    }

    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 获取所有美客多站点
 */
export async function getSites(accessToken: string): Promise<MLSite[]> {
  return mlFetch("/sites", accessToken) as Promise<MLSite[]>;
}

/**
 * 获取站点下的顶级分类
 */
export async function getCategories(siteId: string, accessToken: string): Promise<MLCategory[]> {
  return mlFetch(`/sites/${siteId}/categories`, accessToken) as Promise<MLCategory[]>;
}

/**
 * 获取分类详情（含子分类）
 */
export async function getCategoryDetail(categoryId: string, accessToken: string): Promise<MLCategory> {
  return mlFetch(`/categories/${categoryId}`, accessToken) as Promise<MLCategory>;
}

/**
 * 获取分类的必填/可选属性
 */
export async function getCategoryAttributes(
  categoryId: string,
  accessToken: string
): Promise<MLCategoryAttribute[]> {
  return mlFetch(`/categories/${categoryId}/attributes`, accessToken) as Promise<MLCategoryAttribute[]>;
}

/**
 * 根据商品标题搜索预测分类
 * 使用 domain_discovery/search API
 */
export async function predictCategory(
  accessToken: string,
  _siteId: string,
  query: string
): Promise<MLPredictedCategory[]> {
  return mlFetch(
    `/marketplace/domain_discovery/search?q=${encodeURIComponent(query)}`,
    accessToken
  ) as Promise<MLPredictedCategory[]>;
}

/**
 * Global Selling (CBT) 创建商品刊登
 * 参考: https://global-selling.mercadolibre.com/devsite/global-listing
 * - 标题必须为英文
 * - 价格固定为 USD
 * - 描述内联在请求体中
 * - 图片使用 source URL
 */
export async function createItem(
  accessToken: string,
  itemData: MLCreateItemRequest
): Promise<MLCreateItemResponse> {
  try {
    const result = await mlFetch("/global/items", accessToken, {
      method: "POST",
      body: JSON.stringify(itemData),
      timeout: 90000,
    }) as MLCreateItemResponse;
    console.log("[createItem] ML 接口返回(成功):", JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    console.log("[createItem] ML 接口返回(失败):", err instanceof Error ? err.message : String(err));
    throw err;
  }
}