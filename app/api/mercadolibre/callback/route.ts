import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/mercadolibre/auth";
import { getMLAccount, saveMLAccount } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // 用户拒绝授权
  if (error) {
    const url = new URL("/mercadolibre", request.url);
    url.searchParams.set("status", "error");
    url.searchParams.set("message", "用户取消了授权。");
    return NextResponse.redirect(url, { status: 303 });
  }

  if (!code) {
    const url = new URL("/mercadolibre", request.url);
    url.searchParams.set("status", "error");
    url.searchParams.set("message", "缺少授权码。");
    return NextResponse.redirect(url, { status: 303 });
  }

  try {
    const oauthRes = await exchangeCode(code);

    // 计算过期时间（美客多 access_token 有效 6 小时）
    const tokenExpiresAt = new Date(
      Date.now() + (oauthRes.expires_in - 60) * 1000
    ).toISOString();

    const existing = getMLAccount();
    if (existing) {
      // 已有账号则更新 token
      const { updateMLAccount } = await import("@/lib/db");
      updateMLAccount(oauthRes.user_id, {
        accessToken: oauthRes.access_token,
        refreshToken: oauthRes.refresh_token,
        tokenExpiresAt,
      });
    } else {
      // 新账号则插入
      saveMLAccount({
        mlUserId: oauthRes.user_id,
        siteId: oauthRes.site_id,
        accessToken: oauthRes.access_token,
        refreshToken: oauthRes.refresh_token,
        tokenExpiresAt,
        nickname: oauthRes.nickname || String(oauthRes.user_id),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const url = new URL("/mercadolibre", request.url);
    url.searchParams.set("status", "success");
    url.searchParams.set("message", "美客多账号授权成功！");
    return NextResponse.redirect(url, { status: 303 });
  } catch (err) {
    const url = new URL("/mercadolibre", request.url);
    url.searchParams.set("status", "error");
    url.searchParams.set(
      "message",
      err instanceof Error ? err.message : "授权失败。"
    );
    return NextResponse.redirect(url, { status: 303 });
  }
}