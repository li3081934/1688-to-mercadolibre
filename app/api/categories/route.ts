import path from "node:path";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { createCategory } from "@/lib/db";
import { validateCategoryMapper } from "@/lib/mappers/load-category-mapper";
import { getCategoryDir, removeDirectory, replaceFormFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const code = String(formData.get("code") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const sheetName = String(formData.get("sheetName") || "").trim();
  const templateFile = formData.get("templateFile");
  const mapperFile = formData.get("mapperFile");

  if (!code || !name || !sheetName) {
    return redirectWithMessage(request, "/categories", "error", "分类编码、名称和工作表名不能为空。");
  }

  if (!(templateFile instanceof File) || templateFile.size === 0) {
    return redirectWithMessage(request, "/categories", "error", "请上传 Excel 模板文件。");
  }

  if (!(mapperFile instanceof File) || mapperFile.size === 0) {
    return redirectWithMessage(request, "/categories", "error", "请上传 mapper JS 文件。");
  }

  const categoryId = randomUUID();
  const categoryDir = getCategoryDir(categoryId);
  const templatePath = path.join(categoryDir, "template.xlsx");
  const mapperPath = path.join(categoryDir, "mapper.cjs");

  try {
    await replaceFormFile(templateFile, templatePath);
    await replaceFormFile(mapperFile, mapperPath);
    await validateCategoryMapper(mapperPath);

    const now = new Date().toISOString();
    createCategory({
      id: categoryId,
      code,
      name,
      sheetName,
      templatePath,
      mapperPath,
      isActive: 1,
      createdAt: now,
      updatedAt: now
    });

    return redirectWithMessage(request, "/categories", "success", "分类已创建。");
  } catch (error) {
    await removeDirectory(categoryDir);
    return redirectWithMessage(
      request,
      "/categories",
      "error",
      error instanceof Error ? error.message : "创建分类失败。"
    );
  }
}

function redirectWithMessage(request: Request, routePath: string, status: string, message: string) {
  const url = new URL(routePath, request.url);
  url.searchParams.set("status", status);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url, { status: 303 });
}