import { getBaseUrl } from "@/lib/url";

const ML_AUTH_URL = "https://global-selling.mercadolibre.com/authorization";
const ML_AUTH_URL_STANDARD = "https://auth.mercadolibre.com/authorization";
const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

function getClientId(): string {
  const id = process.env.ML_APP_ID;
  if (!id) throw new Error("环境变量 ML_APP_ID 未设置");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.ML_CLIENT_SECRET;
  if (!secret) throw new Error("环境变量 ML_CLIENT_SECRET 未设置");
  return secret;
}

function getRedirectUri(): string {
  if (process.env.ML_REDIRECT_URI) return process.env.ML_REDIRECT_URI;
  const baseUrl = getBaseUrl();
  return `${baseUrl.replace(/\/+$/, "")}/api/mercadolibre/callback`;
}

/**
 * 生成跳转到美客多授权页面的 URL
 * @param promptLogin - 强制用户重新登录（用于切换账号/测试账号授权）
 * @param standardAuth - 使用标准 OAuth URL（而非 Global Selling），测试账号需要此模式
 */
export function getAuthUrl(promptLogin?: boolean, standardAuth?: boolean): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    scope: "offline_access read write",
  });
  if (promptLogin) params.set("prompt", "login");
  const baseUrl = standardAuth ? ML_AUTH_URL_STANDARD : ML_AUTH_URL;
  return `${baseUrl}?${params.toString()}`;
}

/**
 * 用授权码交换 access_token 和 refresh_token
 */
export async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: getClientId(),
    client_secret: getClientSecret(),
    code,
    redirect_uri: getRedirectUri(),
  });

  const res = await fetch(ML_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const bodyText = await res.text();

  if (!res.ok) {
    throw new Error(`OAuth token 交换失败 (${res.status}): ${bodyText}`);
  }

  const data = JSON.parse(bodyText);

  if (!data.access_token) {
    throw new Error(
      `OAuth token 交换响应异常: ${JSON.stringify(data)}`
    );
  }

  if (!data.refresh_token) {
    console.error(
      "[exchangeCode] 警告: refresh_token 缺失, 完整响应:",
      JSON.stringify(data)
    );
  }

  return data as import("./types").MLOAuthResponse;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.ok || i === retries - 1) return res;
    if (res.status < 500) return res;
    await new Promise((r) =>
      setTimeout(r, Math.min(1000 * 2 ** i + Math.random() * 500, 8000))
    );
  }
  throw new Error("fetchWithRetry: unreachable");
}

/**
 * 用 refresh_token 刷新 access_token
 */
export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
  });

  const res = await fetchWithRetry(ML_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token 刷新失败 (${res.status}): ${text}`);
  }

  return res.json() as Promise<import("./types").MLRefreshResponse>;
}