import { NextResponse } from "next/server";
import { deleteMLAccount, listMLAccounts, setCurrentMLAccount } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(req: Request) {
  try {
    const { mlUserId } = await req.json();
    if (!mlUserId) {
      return NextResponse.json({ success: false, message: "缺少 mlUserId。" }, { status: 400 });
    }
    deleteMLAccount(mlUserId);
    const remaining = listMLAccounts();
    if (!remaining.some((a) => a.isCurrent === 1) && remaining.length > 0) {
      setCurrentMLAccount(remaining[0].mlUserId);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "解绑账号失败。";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const accounts = listMLAccounts().map((a) => ({
      mlUserId: a.mlUserId,
      nickname: a.nickname,
      siteId: a.siteId,
      isCurrent: a.isCurrent === 1,
      isTestUser: a.isTestUser === 1,
      hasToken: !!a.accessToken,
      password: a.password || undefined,
    }));

    return NextResponse.json({ success: true, data: accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询账号列表失败。";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
