import { NextResponse } from "next/server";

import { syncCBTCategories } from "@/lib/mercadolibre/categories";

export const runtime = "nodejs";

export async function POST() {
  console.info("[category-sync-api] POST /api/mercadolibre/categories/sync");
  try {
    const result = await syncCBTCategories();
    console.info(`[category-sync-api] completed total=${result.total}`);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[category-sync-api] failed", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "同步分类失败。",
      },
      { status: 500 },
    );
  }
}