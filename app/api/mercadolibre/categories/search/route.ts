import { NextResponse } from "next/server";
import { predictCategory } from "@/lib/mercadolibre/client";
import { getValidToken } from "@/lib/mercadolibre/token";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId") || "MLB";
  const query = searchParams.get("query") || "";

  if (!query.trim()) {
    return NextResponse.json(
      { success: false, message: "请输入搜索关键词。" },
      { status: 400 }
    );
  }

  try {
    const { token } = await getValidToken();
    const results = await predictCategory(token, siteId, query.trim());
    return NextResponse.json({ success: true, data: results });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "搜索分类失败。",
      },
      { status: 500 }
    );
  }
}
