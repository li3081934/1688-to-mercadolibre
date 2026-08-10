import { NextResponse } from "next/server";
import { getCategoryAttributes } from "@/lib/mercadolibre/client";
import { getValidToken } from "@/lib/mercadolibre/token";
import { translateTexts } from "@/lib/mercadolibre/translation";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ categoryId: string }>;
};

export async function GET(_request: Request, context: RouteParams) {
  const { categoryId } = await context.params;

  try {
    const { token } = await getValidToken();
    const attributes = await getCategoryAttributes(categoryId, token);
    const filtered = attributes.filter((a) => !(a.tags?.read_only));
    const translationItems = filtered.flatMap((attribute) => [
      { text: attribute.name, context: `attribute_name:${attribute.id}` },
      ...(attribute.hint ? [{ text: attribute.hint, context: `attribute_hint:${attribute.id}` }] : []),
      ...(attribute.values || []).map((value) => ({
        text: value.name,
        context: `attribute_value:${attribute.id}:${value.id}`,
      })),
    ]);
    const translations = await translateTexts(translationItems);
    let translationIndex = 0;
    const data = filtered.map((attribute) => {
      const nameTranslation = translations[translationIndex++];
      const hintTranslation = attribute.hint ? translations[translationIndex++] : undefined;
      const valueTranslations = (attribute.values || []).map(() => translations[translationIndex++]);
      return {
        ...attribute,
        display_name: nameTranslation?.translated || attribute.name,
        display_hint: hintTranslation?.translated || attribute.hint,
        display_values: (attribute.values || []).map((value, index) => ({
          ...value,
          display_name: valueTranslations[index]?.translated || value.name,
        })),
        translation_source: nameTranslation?.sourceType || "fallback",
      };
    });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "查询分类属性失败。",
      },
      { status: 500 }
    );
  }
}