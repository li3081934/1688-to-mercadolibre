import { getMLAccount, updateMLAccount } from "@/lib/db";
import { refreshAccessToken } from "@/lib/mercadolibre/auth";

export type ValidTokenResult = {
  token: string;
  siteId: string;
  accountId: number;
};

/**
 * 获取有效的 ML access_token
 * - 检查数据库中账号是否存在
 * - 如 token 已过期则自动刷新并保存新 token
 * - 返回 token、siteId 和 accountId
 */
export async function getValidToken(): Promise<ValidTokenResult> {
  const account = getMLAccount();
  if (!account) {
    throw new Error("未授权。请先登录美客多账号。");
  }

  if (Date.now() >= new Date(account.tokenExpiresAt).getTime()) {
    const refreshRes = await refreshAccessToken(account.refreshToken);
    const tokenExpiresAt = new Date(
      Date.now() + (refreshRes.expires_in - 60) * 1000
    ).toISOString();
    updateMLAccount(account.mlUserId, {
      accessToken: refreshRes.access_token,
      refreshToken: refreshRes.refresh_token,
      tokenExpiresAt,
    });
    return {
      token: refreshRes.access_token,
      siteId: account.siteId,
      accountId: account.id,
    };
  }

  return {
    token: account.accessToken,
    siteId: account.siteId,
    accountId: account.id,
  };
}