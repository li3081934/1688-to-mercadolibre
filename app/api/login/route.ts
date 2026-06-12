import { NextResponse } from "next/server";
import crypto from "node:crypto";

const PASSWORD = process.env.APP_PASSWORD || "Li3081934";

export async function POST(request: Request) {
  const { password } = await request.json();

  if (password !== PASSWORD) {
    return NextResponse.json(
      { success: false, message: "密码错误" },
      { status: 401 }
    );
  }

  const sessionId = crypto.randomBytes(32).toString("hex");
  const signature = crypto
    .createHmac("sha256", PASSWORD)
    .update(sessionId)
    .digest("hex");
  const token = `${sessionId}.${signature}`;

  const { origin } = new URL(request.url);
  const redirectTo = new URL(request.url).searchParams.get("redirect") || "/";

  const response = NextResponse.json({ success: true, redirect: redirectTo });
  response.cookies.set("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return response;
}
