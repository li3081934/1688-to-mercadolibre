import { NextResponse } from "next/server";
import { getCategories, getCategoryDetail } from "@/lib/mercadolibre/client";
import { getValidToken } from "@/lib/mercadolibre/token";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId") || "MLA";
  const categoryId = searchParams.get("categoryId");

  try {
    const { token } = await getValidToken();

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