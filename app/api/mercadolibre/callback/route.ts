import { exchangeCode } from "@/lib/mercadolibre/auth";
import { getMLAccountByUserId, saveMLAccount, setCurrentMLAccount, updateMLAccount, updateMLAccountTags } from "@/lib/db";
import { getBaseUrl } from "@/lib/url";
import type { MLUserResponse } from "@/lib/mercadolibre/types";

export const runtime = "nodejs";

const API_BASE = "https://api.mercadolibre.com";

function redirectTo(path: string, params: Record<string, string>) {
  const base = getBaseUrl();
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return Response.redirect(url.toString(), 303);
}

async function fetchMLUser(accessToken: string): Promise<MLUserResponse> {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`获取用户信息失败 (${res.status}): ${text}`);
  }
  return res.json();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return redirectTo("/mercadolibre", { status: "error", message: "用户取消了授权。" });
  }

  if (!code) {
    return redirectTo("/mercadolibre", { status: "error", message: "缺少授权码。" });
  }

  try {
    const oauthRes = await exchangeCode(code);

    const tokenExpiresAt = new Date(
      Date.now() + (oauthRes.expires_in - 60) * 1000
    ).toISOString();

    if (!oauthRes.refresh_token) {
      throw new Error(
        "OAuth 响应缺少 refresh_token，请在美客多开发者后台确认应用已启用 offline_access 权限。"
      );
    }

    const user = oauthRes.site_id
      ? { site_id: oauthRes.site_id, nickname: oauthRes.nickname ?? String(oauthRes.user_id), tags: oauthRes.nickname ? [] as string[] : [] as string[] }
      : await fetchMLUser(oauthRes.access_token);

    const existingById = getMLAccountByUserId(oauthRes.user_id);
    if (existingById) {
      updateMLAccount(oauthRes.user_id, {
        accessToken: oauthRes.access_token,
        refreshToken: oauthRes.refresh_token,
        tokenExpiresAt,
      });
      if (user.tags && user.tags.length > 0) {
        updateMLAccountTags(oauthRes.user_id, user.tags);
      }
    } else {
      saveMLAccount({
        mlUserId: oauthRes.user_id,
        siteId: user.site_id,
        accessToken: oauthRes.access_token,
        refreshToken: oauthRes.refresh_token,
        tokenExpiresAt,
        nickname: user.nickname,
        tags: JSON.stringify(user.tags ?? []),
        forceUserProduct: 0,
        isCurrent: 0,
        isTestUser: 0,
        password: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    setCurrentMLAccount(oauthRes.user_id);

    return redirectTo("/mercadolibre", { status: "success", message: "美客多账号授权成功！" });
  } catch (err) {
    return redirectTo("/mercadolibre", {
      status: "error",
      message: err instanceof Error ? err.message : "授权失败。",
    });
  }
}