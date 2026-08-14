import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getProductById, listAIModels } from "@/lib/db";
import { editImageWithModel } from "@/lib/ai/client";
import { ensureDirectory, STORAGE_ROOT } from "@/lib/storage";
import { parseProductBundle } from "@/lib/products";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function resolveStorageImage(imageUrl: string) {
  if (!imageUrl.startsWith("/api/storage/")) return null;
  const relativePath = imageUrl.slice("/api/storage/".length).split("?")[0];
  const resolved = path.resolve(STORAGE_ROOT, ...relativePath.split("/").map(decodeURIComponent));
  const relativeToRoot = path.relative(STORAGE_ROOT, resolved);
  if (relativeToRoot.startsWith(`..${path.sep}`) || relativeToRoot === ".." || path.isAbsolute(relativeToRoot)) {
    return null;
  }
  return resolved;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const product = getProductById(id);
  if (!product) return NextResponse.json({ message: "商品不存在。" }, { status: 404 });

  try {
    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl : "";
    if (!prompt) return NextResponse.json({ message: "请输入 AI 提示词。" }, { status: 400 });

    const sourcePath = resolveStorageImage(sourceUrl);
    if (!sourcePath || !sourcePath.startsWith(path.resolve(product.extractedDir) + path.sep)) {
      return NextResponse.json({ message: "源图片路径无效。" }, { status: 400 });
    }
    const sourceStat = await stat(sourcePath);
    if (!sourceStat.isFile()) return NextResponse.json({ message: "源图片不存在。" }, { status: 404 });

    const model = listAIModels().find((item) => item.purpose === "image_editing");
    if (!model) return NextResponse.json({ message: "尚未配置 image_editing 图片生成模型。" }, { status: 400 });

    const sourceBuffer = await readFile(sourcePath);
    const sourceExtension = path.extname(sourcePath).toLowerCase();
    const sourceMimeType = sourceExtension === ".jpg" || sourceExtension === ".jpeg"
      ? "image/jpeg"
      : sourceExtension === ".webp" ? "image/webp" : "image/png";
    const generated = await editImageWithModel(
      model.id,
      sourceBuffer,
      sourceMimeType,
      `source${sourceExtension || ".png"}`,
      prompt,
    );

    const bundle = await parseProductBundle(product.extractedDir);
    const sharedImagesDir = bundle.sharedImagesDir || path.join(path.dirname(bundle.mainJsonPath), "shared-images", "images");
    const extension = MIME_EXTENSIONS[generated.mimeType] || ".png";
    const sourceBaseName = path.basename(sourcePath, sourceExtension || path.extname(sourcePath));
    const fileName = `${sourceBaseName}-ai-${Date.now()}${extension}`;
    const filePath = path.join(sharedImagesDir, fileName);
    await ensureDirectory(sharedImagesDir);
    await writeFile(filePath, generated.data);

    const relativePath = path.relative(STORAGE_ROOT, filePath).replace(/\\/g, "/");
    return NextResponse.json({
      success: true,
      imageUrl: `/api/storage/${relativePath}`,
      imageName: fileName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成图片失败。";
    return NextResponse.json({ message }, { status: 500 });
  }
}