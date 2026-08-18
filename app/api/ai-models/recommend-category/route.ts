import { NextResponse } from "next/server";

import {
  CategoryRecommendationInputError,
  recommendCategoryByTitle,
} from "@/lib/mercadolibre/category-recommendation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { title?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ success: false, message: "商品标题不能为空。" }, { status: 400 });
    }

    const recommendation = await recommendCategoryByTitle(title);
    return NextResponse.json({ success: true, data: recommendation });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "AI 推荐分类失败。" },
      { status: error instanceof CategoryRecommendationInputError ? error.statusCode : 500 },
    );
  }
}