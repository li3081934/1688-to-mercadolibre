const ML_AUTH_URL = "https://auth.mercadolibre.com/authorization";
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
  return process.env.ML_REDIRECT_URI || "http://localhost:3000/api/mercadolibre/callback";
}

/**
 * 生成跳转到美客多授权页面的 URL
 */
export function getAuthUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
  });
  return `${ML_AUTH_URL}?${params.toString()}`;
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token 交换失败 (${res.status}): ${text}`);
  }

  return res.json() as Promise<import("./types").MLOAuthResponse>;
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

  const res = await fetch(ML_TOKEN_URL, {
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