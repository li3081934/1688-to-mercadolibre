import { NextResponse } from "next/server";
import { getMLAccountByUserId, setCurrentMLAccount } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { mlUserId } = await request.json();

    if (!mlUserId) {
      return NextResponse.json(
        { success: false, message: "缺少 mlUserId。" },
        { status: 400 }
      );
    }

    const account = getMLAccountByUserId(mlUserId);
    if (!account) {
      return NextResponse.json(
        { success: false, message: "账号不存在。" },
        { status: 404 }
      );
    }

    setCurrentMLAccount(mlUserId);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "切换账号失败。";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
