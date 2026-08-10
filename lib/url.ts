import { NextResponse } from "next/server";

const FALLBACK = "http://localhost:3000";

export function getBaseUrl(request?: Request): string {
  const envUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  if (request) {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  }
  return FALLBACK;
}

export function redirectWithMessage(
  request: Request,
  path: string,
  status: string,
  message: string
) {
  const base = getBaseUrl(request);
  const url = new URL(path, base);
  url.searchParams.set("status", status);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url, { status: 303 });
}
