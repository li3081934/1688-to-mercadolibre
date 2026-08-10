import type { MLCategory, MLCategoryAttribute, MLCreateItemResponse, MLCreateUPItemRequest, MLCreateUPItemResponse, MLMarketplaceUserResponse, MLPredictedCategory, MLSite, MLTestUserResponse, MLUPMappingItem, MLUserResponse } from "./types";

const API_BASE = "https://api.mercadolibre.com";

/**
 * 带 access_token 的 fetch 封装
 */
export async function mlFetch(endpoint: string, accessToken: string, options?: RequestInit & { timeout?: number }) {
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
 * 获取卖家已配置的可售市场列表
 */
export async function getMarketplaceUsers(
  accessToken: string,
  userId: number
): Promise<MLMarketplaceUserResponse> {
  return mlFetch(`/marketplace/users/${userId}`, accessToken) as Promise<MLMarketplaceUserResponse>;
}

/**
 * 获取 ML 用户信息（含 tags）
 */
export async function getUser(
  accessToken: string,
  userId?: number
): Promise<MLUserResponse> {
  const endpoint = userId ? `/users/${userId}` : "/users/me";
  return mlFetch(endpoint, accessToken) as Promise<MLUserResponse>;
}

/**
 * User Products (UP) 创建商品刊登
 * 参考: https://global-selling.mercadolibre.com/devsite/price-per-variation-cbt
 * - 使用 family_name 代替 title
 * - 图片只支持 { id } 格式
 * - 不支持 variations 数组
 */
export async function createUPItem(
  accessToken: string,
  itemData: MLCreateUPItemRequest
): Promise<MLCreateUPItemResponse> {
  console.log("[createUPItem] POST /global/items 请求参数:", JSON.stringify(itemData, null, 2));
  try {
    const result = await mlFetch("/global/items", accessToken, {
      method: "POST",
      body: JSON.stringify(itemData),
      timeout: 90000,
    }) as MLCreateUPItemResponse;
    console.log("[createUPItem] ML 接口返回:", JSON.stringify(result, null, 2));

    const siteErrors = result.site_items.filter((s) => s.error);
    if (siteErrors.length > 0) {
      const details = siteErrors
        .map((s) => `[${s.site_id}] ${s.error?.error || s.error?.message}`)
        .join("; ");
      throw new Error(`站点刊登失败: ${details}`);
    }

    return result;
  } catch (err) {
    console.log("[createUPItem] ML 接口返回(失败):", err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/**
 * 查询 UP 映射关系 (siteless <-> site items)
 * GET /marketplace/user-products/{siteless_user_product_id}/mapping
 */
export async function getUPMapping(
  accessToken: string,
  sitelessUserProductId: string
): Promise<MLUPMappingItem[]> {
  return mlFetch(
    `/marketplace/user-products/${sitelessUserProductId}/mapping`,
    accessToken
  ) as Promise<MLUPMappingItem[]>;
}

/**
 * 创建测试用户
 * POST /users/test_user
 * 需要当前应用的 ACCESS_TOKEN
 */
export async function createTestUser(
  accessToken: string,
  siteId: string
): Promise<MLTestUserResponse> {
  return mlFetch("/users/test_user", accessToken, {
    method: "POST",
    body: JSON.stringify({ site_id: siteId }),
  }) as Promise<MLTestUserResponse>;
}