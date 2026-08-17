import {
  getCategories,
  getCategoryDetail,
  getCategoryDump,
} from "@/lib/mercadolibre/client";
import {
  pruneMLCategories,
  upsertMLCategories,
  type MLCategoryRecord,
} from "@/lib/db";
import { getValidToken } from "@/lib/mercadolibre/token";
import type { MLCategory } from "@/lib/mercadolibre/types";

export const CATEGORY_SITE_ID = "CBT";

type CategoryNode = {
  id: string;
  name: string;
  parentCategoryId: string | null;
  pathFromRoot: Array<{ id: string; name: string }>;
  sortOrder: number;
  hasChildren: boolean;
};

function childCategories(category: MLCategory) {
  if (category.children?.length) {
    return category.children;
  }
  return (category.children_categories || []).map((child) => ({
    id: child.id,
    name: child.name,
  }));
}

function flattenCategories(categories: MLCategory[]) {
  const result = new Map<string, CategoryNode>();
  const visit = (
    category: MLCategory,
    parentCategoryId: string | null,
    pathFromRoot: Array<{ id: string; name: string }>,
    sortOrder: number,
  ) => {
    const path = [...pathFromRoot, { id: category.id, name: category.name }];
    const children = childCategories(category);
    if (!result.has(category.id)) {
      result.set(category.id, {
        id: category.id,
        name: category.name,
        parentCategoryId,
        pathFromRoot: path,
        sortOrder,
        hasChildren: children.length > 0,
      });
    }
    children.forEach((child, index) => {
      visit(child, category.id, path, index);
    });
  };
  categories.forEach((category, index) => visit(category, null, [], index));
  return [...result.values()];
}

async function loadFallbackTree(accessToken: string) {
  console.info(`[category-sync] ${CATEGORY_SITE_ID}: category dump unavailable, starting recursive fallback`);
  const roots = await getCategories(CATEGORY_SITE_ID, accessToken);
  console.info(`[category-sync] ${CATEGORY_SITE_ID}: fallback received ${roots.length} root categories`);
  const visit = async (
    category: MLCategory,
    parentPath: Array<{ id: string; name: string }>,
    seen: Set<string>,
  ): Promise<MLCategory> => {
    if (seen.has(category.id)) return category;
    seen.add(category.id);
    const detail = await getCategoryDetail(category.id, accessToken);
    const children = childCategories(detail);
    const hydratedChildren: MLCategory[] = [];
    for (const child of children) {
      hydratedChildren.push(await visit(child, [...parentPath, { id: category.id, name: category.name }], seen));
    }
    return { ...detail, children: hydratedChildren };
  };
  const seen = new Set<string>();
  return Promise.all(roots.map((root) => visit(root, [], seen)));
}

async function loadCategoryTree(accessToken: string) {
  const startedAt = Date.now();
  try {
    const categories = await getCategoryDump(CATEGORY_SITE_ID, accessToken);
    console.info(`[category-sync] ${CATEGORY_SITE_ID}: dump loaded, roots=${categories.length}, elapsedMs=${Date.now() - startedAt}`);
    return categories;
  } catch (dumpError) {
    console.warn(
      `[category-sync] ${CATEGORY_SITE_ID}: dump failed after ${Date.now() - startedAt}ms`,
      dumpError,
    );
    try {
      const categories = await loadFallbackTree(accessToken);
      console.info(`[category-sync] ${CATEGORY_SITE_ID}: fallback loaded, roots=${categories.length}, elapsedMs=${Date.now() - startedAt}`);
      return categories;
    } catch (fallbackError) {
      const dumpMessage = dumpError instanceof Error ? dumpError.message : "dump failed";
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : "fallback failed";
      throw new Error(`分类树获取失败：${dumpMessage}；递归回退也失败：${fallbackMessage}`);
    }
  }
}

export async function syncCBTCategories() {
  const startedAt = Date.now();
  console.info(`[category-sync] ${CATEGORY_SITE_ID}: sync started`);
  const { token } = await getValidToken();
  console.info(`[category-sync] ${CATEGORY_SITE_ID}: access token ready`);
  const sourceTree = await loadCategoryTree(token);
  const nodes = flattenCategories(sourceTree);
  console.info(`[category-sync] ${CATEGORY_SITE_ID}: flattened ${nodes.length} categories`);
  const now = new Date().toISOString();
  const records: MLCategoryRecord[] = nodes.map((node) => ({
    siteId: CATEGORY_SITE_ID,
    categoryId: node.id,
    parentCategoryId: node.parentCategoryId,
    name: node.name,
    displayName: node.name,
    pathFromRoot: node.pathFromRoot,
    hasChildren: node.hasChildren,
    sortOrder: node.sortOrder,
    syncedAt: now,
    createdAt: now,
    updatedAt: now,
  }));
  upsertMLCategories(records);
  const removed = pruneMLCategories(CATEGORY_SITE_ID, nodes.map((node) => node.id));
  console.info(`[category-sync] ${CATEGORY_SITE_ID}: sync completed, total=${records.length}, removed=${removed}, elapsedMs=${Date.now() - startedAt}`);
  return {
    siteId: CATEGORY_SITE_ID,
    total: records.length,
    removed,
    syncedAt: now,
  };
}