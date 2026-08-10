import { NextResponse } from "next/server";
import { getMLAccount, saveMLAccount } from "@/lib/db";
import { createTestUser } from "@/lib/mercadolibre/client";
import { getValidToken } from "@/lib/mercadolibre/token";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { siteId } = await request.json();

    if (!siteId) {
      return NextResponse.json(
        { success: false, message: "缺少 siteId。" },
        { status: 400 }
      );
    }

    const { token } = await getValidToken();
    const testUser = await createTestUser(token, siteId);

    const now = new Date().toISOString();
    saveMLAccount({
      mlUserId: testUser.id,
      siteId,
      accessToken: "",
      refreshToken: "",
      tokenExpiresAt: "",
      nickname: testUser.nickname,
      password: testUser.password,
      tags: "[]",
      forceUserProduct: 0,
      isCurrent: 0,
      isTestUser: 1,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      data: {
        mlUserId: testUser.id,
        nickname: testUser.nickname,
        password: testUser.password,
        siteId,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "创建测试账号失败。";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
