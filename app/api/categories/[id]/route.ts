import path from "node:path";

import { NextResponse } from "next/server";

import { countProductsByCategory, deleteCategory, getCategoryById, updateCategory } from "@/lib/db";
import { validateCategoryMapper } from "@/lib/mappers/load-category-mapper";
import { removeDirectory, replaceFormFile } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const category = getCategoryById(id);

  if (!category) {
    return redirectWithMessage(request, "/categories", "error", "分类不存在。");
  }

  const formData = await request.formData();
  if (String(formData.get("_method") || "").toLowerCase() === "delete") {
    if (countProductsByCategory(id) > 0) {
      return redirectWithMessage(request, "/categories", "error", "该分类下还有商品，请先删除商品后再删除分类。");
    }

    deleteCategory(id);
    await removeDirectory(path.dirname(category.mapperPath));

    return redirectWithMessage(request, "/categories", "success", "分类已删除。");
  }

  const name = String(formData.get("name") || category.name).trim();
  const code = String(formData.get("code") || category.code).trim();
  const sheetName = String(formData.get("sheetName") || category.sheetName).trim();
  const isActive = String(formData.get("isActive") || String(category.isActive)) === "1" ? 1 : 0;
  const templateFile = formData.get("templateFile");
  const mapperFile = formData.get("mapperFile");
  let templatePath = category.templatePath;
  let mapperPath = category.mapperPath;

  try {
    if (templateFile instanceof File && templateFile.size > 0) {
      templatePath = path.join(path.dirname(category.templatePath), "template.xlsx");
      await replaceFormFile(templateFile, templatePath);
    }

    if (mapperFile instanceof File && mapperFile.size > 0) {
      mapperPath = path.join(path.dirname(category.mapperPath), "mapper.cjs");
      await replaceFormFile(mapperFile, mapperPath);
      await validateCategoryMapper(mapperPath);
    }

    updateCategory(id, {
      code,
      name,
      sheetName,
      templatePath,
      mapperPath,
      isActive
    });

    return redirectWithMessage(request, "/categories", "success", "分类已更新。");
  } catch (error) {
    return redirectWithMessage(
      request,
      "/categories",
      "error",
      error instanceof Error ? error.message : "更新分类失败。"
    );
  }
}

function redirectWithMessage(request: Request, routePath: string, status: string, message: string) {
  const url = new URL(routePath, request.url);
  url.searchParams.set("status", status);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url, { status: 303 });
}