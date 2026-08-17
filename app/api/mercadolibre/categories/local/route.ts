import { NextResponse } from "next/server";

import {
  getMLCategorySyncStatus,
  listMLCategoryChildren,
  listMLCategories,
  listMLCategoryRoots,
} from "@/lib/db";
import { CATEGORY_SITE_ID } from "@/lib/mercadolibre/categories";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("parentId");
  const includeAll = searchParams.get("all") === "1";
  const data = includeAll
    ? listMLCategories(CATEGORY_SITE_ID)
    : parentId
      ? listMLCategoryChildren(CATEGORY_SITE_ID, parentId)
      : listMLCategoryRoots(CATEGORY_SITE_ID);
  const status = getMLCategorySyncStatus(CATEGORY_SITE_ID);

  return NextResponse.json({
    success: true,
    data,
    siteId: CATEGORY_SITE_ID,
    status,
  });
}