import type { MLCategory, MLSite } from "./types";

const API_BASE = "https://api.mercadolibre.com";

/**
 * 带 access_token 的 fetch 封装
 */
async function mlFetch(endpoint: string, accessToken: string, options?: RequestInit) {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
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