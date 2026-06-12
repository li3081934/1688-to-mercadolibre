import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getValidToken } from "@/lib/mercadolibre/token";

export const runtime = "nodejs";

const ML_API_BASE = "https://api.mercadolibre.com";
const STORAGE_ROOT = path.join(process.cwd(), "storage");

export async function POST(request: Request) {
  try {
    let { imagePath } = await request.json();
    if (!imagePath) {
      return NextResponse.json({ success: false, message: "缺少 imagePath" }, { status: 400 });
    }

    let resolvedPath = path.resolve(imagePath);
    if (!resolvedPath.startsWith(STORAGE_ROOT)) {
      resolvedPath = path.resolve(STORAGE_ROOT, imagePath);
    }
    resolvedPath = path.resolve(resolvedPath);
    if (!resolvedPath.startsWith(STORAGE_ROOT)) {
      return NextResponse.json({ success: false, message: "路径不合法" }, { status: 403 });
    }

    const buffer = await readFile(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

    const { token } = await getValidToken();

    const formData = new FormData();
    const blob = new Blob([buffer], { type: mime });
    formData.append("file", blob, path.basename(resolvedPath));

    const mlRes = await fetch(`${ML_API_BASE}/pictures/items/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!mlRes.ok) {
      const text = await mlRes.text();
      throw new Error(`ML 上传图片失败 (${mlRes.status}): ${text}`);
    }

    const data = await mlRes.json();
    return NextResponse.json({ success: true, data: { id: data.id, url: data.secure_url || data.url } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "上传图片失败";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
