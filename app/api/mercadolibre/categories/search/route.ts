import { NextResponse } from "next/server";
import { getCategoryDetail, predictCategory } from "@/lib/mercadolibre/client";
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
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        try {
          const category = await getCategoryDetail(result.category_id, token);
          return {
            ...result,
            path_from_root: category.path_from_root,
          };
        } catch {
          return result;
        }
      }),
    );
    return NextResponse.json({ success: true, data: enrichedResults });
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
