import { NextResponse } from "next/server";

import {
  getMLCategorySyncStatus,
  listMLCategoryChildren,
  listMLCategories,
  listMLCategoryRoots,
  upsertMLCategories,
  getMLCategory,
  type MLCategoryRecord,
} from "@/lib/db";
import { getCategoryDetail } from "@/lib/mercadolibre/client";
import { CATEGORY_SITE_ID } from "@/lib/mercadolibre/categories";
import { getValidToken } from "@/lib/mercadolibre/token";
import { translateTexts } from "@/lib/mercadolibre/translation";
import type { MLCategory } from "@/lib/mercadolibre/types";

export const runtime = "nodejs";

const TRANSLATION_TIMEOUT_MS = 8000;

function categoryChildren(category: MLCategory): MLCategory[] {
  if (category.children?.length) return category.children;
  return (category.children_categories || []).map((child) => ({
    id: child.id,
    name: child.name,
  } as MLCategory));
}

async function hydrateChildren(parentRows: MLCategoryRecord[]) {
  const incompleteRows = parentRows.filter((row) => !row.hasChildren);
  if (incompleteRows.length === 0) return parentRows;

  try {
    const { token } = await getValidToken();
    const details = await Promise.all(
      incompleteRows.map(async (row) => {
        try {
          return { row, detail: await getCategoryDetail(row.categoryId, token) };
        } catch (error) {
          console.warn(`[category-local] detail failed categoryId=${row.categoryId}`, error);
          return { row, detail: null };
        }
      }),
    );
    const now = new Date().toISOString();
    const newRecords: MLCategoryRecord[] = [];
    const updatedRows = parentRows.map((row) => {
      const result = details.find((item) => item.row.categoryId === row.categoryId);
      if (!result?.detail) return row;
      const children = categoryChildren(result.detail);
      const updated = {
        ...row,
        hasChildren: children.length > 0,
        status: result.detail.settings?.status || result.detail.status || row.status,
        listingAllowed: result.detail.settings?.listing_allowed ?? result.detail.listing_allowed ?? row.listingAllowed,
        updatedAt: now,
        syncedAt: now,
      };
      children.forEach((child, index) => {
        newRecords.push({
          siteId: CATEGORY_SITE_ID,
          categoryId: child.id,
          parentCategoryId: row.categoryId,
          name: child.name,
          displayName: child.name,
          pathFromRoot: [...row.pathFromRoot, { id: child.id, name: child.name }],
          hasChildren: Boolean(child.children?.length || child.children_categories?.length),
          status: child.settings?.status || child.status || null,
          listingAllowed: child.settings?.listing_allowed ?? child.listing_allowed ?? null,
          sortOrder: index,
          syncedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      });
      return updated;
    });
    upsertMLCategories([...updatedRows, ...newRecords]);
    return updatedRows;
  } catch (error) {
    console.warn("[category-local] unable to hydrate category children", error);
    return parentRows;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("parentId");
  const categoryId = searchParams.get("categoryId");
  const includeAll = searchParams.get("all") === "1";
  const statusFilter = searchParams.get("status") || "enabled";
  console.info(`[category-local] request parentId=${parentId || "ROOT"} status=${statusFilter} all=${includeAll}`);
  if (!/^[a-z_]+$/i.test(statusFilter)) {
    return NextResponse.json({ success: false, message: "无效的分类状态。" }, { status: 400 });
  }
  if (categoryId) {
    const category = getMLCategory(CATEGORY_SITE_ID, categoryId);
    if (!category) {
      return NextResponse.json({ success: false, message: "分类不存在。" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      data: [{
        ...category,
        displayName: category.displayName || category.name,
      }],
      siteId: CATEGORY_SITE_ID,
      status: getMLCategorySyncStatus(CATEGORY_SITE_ID),
    });
  }

  let data = includeAll
    ? listMLCategories(CATEGORY_SITE_ID)
    : parentId
      ? listMLCategoryChildren(CATEGORY_SITE_ID, parentId, { status: statusFilter })
      : listMLCategoryRoots(CATEGORY_SITE_ID, { status: statusFilter });
  if (!includeAll && parentId) {
    data = await hydrateChildren(data);
  }
  console.info(
    `[category-local] database rows=${data.length} parentId=${parentId || "ROOT"} statuses=${JSON.stringify([...new Set(data.map((item) => item.status))])}`,
  );
  const translations = includeAll
    ? []
    : await Promise.race([
        translateTexts(data.map((item) => ({ text: item.name, context: "category_name" }))),
        new Promise<never>((resolve) => {
          setTimeout(() => resolve([] as never), TRANSLATION_TIMEOUT_MS);
        }),
      ]);
  const translated = data.map((item, index) => ({
    ...item,
    displayName: translations[index]?.translated || item.displayName || item.name,
  }));
  console.info(`[category-local] response rows=${translated.length} parentId=${parentId || "ROOT"}`);
  const status = getMLCategorySyncStatus(CATEGORY_SITE_ID);

  return NextResponse.json({
    success: true,
    data: translated,
    siteId: CATEGORY_SITE_ID,
    status,
  });
}