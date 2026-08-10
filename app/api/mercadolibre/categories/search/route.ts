import { NextResponse } from "next/server";
import { getCategoryDetail, predictCategory } from "@/lib/mercadolibre/client";
import { getValidToken } from "@/lib/mercadolibre/token";
import { translateTexts } from "@/lib/mercadolibre/translation";

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
    const translationItems = enrichedResults.flatMap((result) => {
      const pathFromRoot = "path_from_root" in result && Array.isArray(result.path_from_root)
        ? result.path_from_root
        : [];
      return [
        { text: result.category_name, context: "category_name" },
        { text: result.domain_name, context: "domain_name" },
        ...pathFromRoot.map((item) => ({ text: item.name, context: "category_path" })),
      ];
    });
    const translations = await translateTexts(translationItems);
    let translationIndex = 0;
    const data = enrichedResults.map((result) => {
      const pathFromRoot = "path_from_root" in result && Array.isArray(result.path_from_root)
        ? result.path_from_root
        : [];
      const categoryTranslation = translations[translationIndex++];
      const domainTranslation = translations[translationIndex++];
      const pathTranslations = pathFromRoot.map(() => translations[translationIndex++]);
      return {
        ...result,
        display_category_name: categoryTranslation?.translated || result.category_name,
        display_domain_name: domainTranslation?.translated || result.domain_name,
        display_path_from_root: pathFromRoot.map((item, index) => ({
          ...item,
          display_name: pathTranslations[index]?.translated || item.name,
        })),
        translation_source: categoryTranslation?.sourceType || "fallback",
      };
    });
    return NextResponse.json({ success: true, data });
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
