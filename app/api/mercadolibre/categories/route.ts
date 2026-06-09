import { NextResponse } from "next/server";
import { getMLAccount, updateMLAccount } from "@/lib/db";
import { refreshAccessToken } from "@/lib/mercadolibre/auth";
import { getCategories, getCategoryDetail } from "@/lib/mercadolibre/client";

export const runtime = "nodejs";

async function getValidToken() {
  const account = getMLAccount();
  if (!account) {
    throw new Error("未授权。请先登录美客多账号。");
  }

  // 检查 access_token 是否过期
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
    return refreshRes.access_token;
  }

  return account.accessToken;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId") || "MLA";
  const categoryId = searchParams.get("categoryId");

  try {
    const token = await getValidToken();

    if (categoryId) {
      const category = await getCategoryDetail(categoryId, token);
      return NextResponse.json({ success: true, data: category });
    }

    const categories = await getCategories(siteId, token);
    return NextResponse.json({ success: true, data: categories });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "查询分类失败。",
      },
      { status: 500 }
    );
  }
}