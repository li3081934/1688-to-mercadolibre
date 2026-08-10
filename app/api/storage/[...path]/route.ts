import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { STORAGE_ROOT } from "@/lib/storage";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function resolveStoragePath(segments: string[]) {
  const relativePath = segments.map((segment) => decodeURIComponent(segment)).join(path.sep);
  const resolvedPath = path.resolve(STORAGE_ROOT, relativePath);
  const relativeToRoot = path.relative(STORAGE_ROOT, resolvedPath);

  if (
    relativeToRoot.startsWith(`..${path.sep}`) ||
    relativeToRoot === ".." ||
    path.isAbsolute(relativeToRoot)
  ) {
    return null;
  }

  return resolvedPath;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { path: pathSegments } = await context.params;
    const filePath = resolveStoragePath(pathSegments || []);
    if (!filePath) {
      return NextResponse.json({ error: "路径不合法。" }, { status: 403 });
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[extension];
    if (!contentType) {
      return NextResponse.json({ error: "不支持的文件类型。" }, { status: 404 });
    }

    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "文件不存在。" }, { status: 404 });
    }

    const file = await readFile(filePath);

    return new NextResponse(file, {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(file.byteLength),
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ error: "文件不存在。" }, { status: 404 });
    }

    return NextResponse.json({ error: "读取文件失败。" }, { status: 500 });
  }
}
