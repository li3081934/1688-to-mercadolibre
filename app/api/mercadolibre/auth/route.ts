import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/mercadolibre/auth";
import { getMLAccount, listMLAccounts } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const account = getMLAccount();
  const allAccounts = listMLAccounts().map((a) => ({
    mlUserId: a.mlUserId,
    nickname: a.nickname,
    siteId: a.siteId,
    isCurrent: a.isCurrent === 1,
    isTestUser: a.isTestUser === 1,
    hasToken: !!a.accessToken,
    password: a.password || undefined,
  }));

  const hasToken = account ? !!account.accessToken : false;

  let tags: string[] = [];
  let forceUserProduct = false;
  try {
    if (account) {
      tags = JSON.parse(account.tags || "[]");
      forceUserProduct = account.forceUserProduct === 1;
    }
  } catch {}

  return NextResponse.json({
    authenticated: hasToken,
    authUrl: getAuthUrl(),
    authUrlLogin: getAuthUrl(true),
    authUrlTest: getAuthUrl(true, true),
    mlUserId: account?.mlUserId,
    siteId: account?.siteId,
    nickname: account?.nickname,
    tokenExpiresAt: account?.tokenExpiresAt,
    tags,
    forceUserProduct,
    isUserProductSeller: tags.includes("user_product_seller"),
    isTestUser: account?.isTestUser === 1,
    accounts: allAccounts,
  });
}