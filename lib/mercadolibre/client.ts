import type { MLCategory, MLCategoryAttribute, MLCreateItemResponse, MLCreateUPItemRequest, MLCreateUPItemResponse, MLCreateUPItemsBatchRequest, MLCreateUPItemsBatchResponse, MLMarketplaceUserResponse, MLPredictedCategory, MLSite, MLTestUserResponse, MLUPMappingItem, MLUserResponse } from "./types";

const API_BASE = "https://api.mercadolibre.com";

export type MLCurrentPublishedItem = {
  id: string;
  site_id?: string;
  title?: string;
  status?: string;
  category_id?: string;
  available_quantity?: number;
  price?: number;
  net_proceeds?: { amount?: number };
  cbt_item_id?: string;
  user_product_id?: string;
  parent_id?: string;
};

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

    const siteItems = Array.isArray(result.site_items) ? result.site_items : [];
    if (siteItems.length === 0) {
      throw new Error("UP 刊登失败：接口未返回有效的站点商品结果。");
    }

    const successfulSiteItems = siteItems.filter((site) => site.item_id && !site.error);
    const siteErrors = siteItems.filter((site) => !site.item_id || site.error);
    if (successfulSiteItems.length === 0) {
      const details = siteErrors
        .map((s) => `[${s.site_id}] ${s.error?.error || s.error?.message || "接口未返回商品 ID"}`)
        .join("; ");
      throw new Error(`站点刊登失败: ${details || "接口未返回成功的站点商品"}`);
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

export async function getCurrentPublishedItems(
  accessToken: string,
  mlUserId: number,
  options: { status?: string } = {}
): Promise<MLCurrentPublishedItem[]> {
  const user = await mlFetch(`/marketplace/users/${mlUserId}`, accessToken) as {
    user_id?: number;
  };
  const merchantId = user.user_id || mlUserId;
  const itemIds: string[] = [];
  let scrollId: string | undefined;
  let previousScrollId: string | undefined;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({ search_type: "scan", limit: String(limit) });
    if (scrollId) params.set("scroll_id", scrollId);
    if (options.status && options.status !== "all") params.set("status", options.status);
    const searchResult = await mlFetch(
      `/marketplace/users/${merchantId}/items/search?${params.toString()}`,
      accessToken
    ) as { results?: string[]; scroll_id?: string | null };
    const results = Array.isArray(searchResult.results) ? searchResult.results : [];
    itemIds.push(...results);
    previousScrollId = scrollId;
    scrollId = searchResult.scroll_id || undefined;
    if (results.length === 0 || !scrollId || scrollId === previousScrollId) {
      break;
    }
  }

  const items: MLCurrentPublishedItem[] = [];
  for (let index = 0; index < itemIds.length; index += 20) {
    const ids = itemIds.slice(index, index + 20).join(",");
    const response = await mlFetch(
      `/items?ids=${encodeURIComponent(ids)}&attributes=id,site_id,title,status,category_id,available_quantity,price,net_proceeds,cbt_item_id,user_product_id,parent_id`,
      accessToken
    ) as Array<{ code: number; body?: MLCurrentPublishedItem }>;
    for (const item of response) {
      if (item.code === 200 && item.body) {
        items.push(item.body);
      }
    }
  }

  return items;
}

/**
 * 批量创建同一商品族下的多个 User Product
 * POST /global/user-products/families
 */
export async function createUPItemsBatch(
  accessToken: string,
  items: MLCreateUPItemsBatchRequest,
): Promise<MLCreateUPItemsBatchResponse> {
  if (items.length === 0) {
    return [];
  }

    console.log("[createUPItemsBatch] POST /global/user-products/families 请求数量:", items.length);
  const result = await mlFetch("/global/user-products/families", accessToken, {
    method: "POST",
    body: JSON.stringify(items),
    timeout: 90000,
  }) as MLCreateUPItemsBatchResponse;

  if (!Array.isArray(result)) {
    throw new Error("批量 UP 刊登失败：接口返回格式无效。");
  }

  console.log("[createUPItemsBatch] ML 接口返回数量:", result.length);
  return result;

}