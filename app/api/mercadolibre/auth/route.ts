import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/mercadolibre/auth";
import { getMLAccount } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const account = getMLAccount();

  // 已认证，返回账号信息
  if (account) {
    return NextResponse.json({
      authenticated: true,
      mlUserId: account.mlUserId,
      siteId: account.siteId,
      nickname: account.nickname,
      tokenExpiresAt: account.tokenExpiresAt,
    });
  }

  // 未认证，返回授权链接
  return NextResponse.json({
    authenticated: false,
    authUrl: getAuthUrl(),
  });
}