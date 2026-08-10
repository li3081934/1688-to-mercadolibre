import { NextResponse } from "next/server";

import { getMLAccount, setForceUserProduct } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { force } = await request.json();
    const account = getMLAccount();
    if (!account) {
      return NextResponse.json(
        { success: false, message: "未连接美客多账号。" },
        { status: 400 }
      );
    }

    setForceUserProduct(account.mlUserId, !!force);

    return NextResponse.json({
      success: true,
      forceUserProduct: !!force,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "设置失败。";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
