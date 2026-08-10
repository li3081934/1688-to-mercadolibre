import { NextResponse } from "next/server";

import { updateTranslationCacheText } from "@/lib/db";

export const runtime = "nodejs";

const MAX_TRANSLATED_TEXT_LENGTH = 10_000;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "缓存 ID 无效。" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const translatedText = typeof body.translatedText === "string"
      ? body.translatedText.trim()
      : "";
    if (!translatedText) {
      return NextResponse.json({ error: "译文不能为空。" }, { status: 400 });
    }
    if (translatedText.length > MAX_TRANSLATED_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `译文不能超过 ${MAX_TRANSLATED_TEXT_LENGTH} 个字符。` },
        { status: 400 },
      );
    }

    const record = updateTranslationCacheText(id, translatedText);
    if (!record) {
      return NextResponse.json({ error: "翻译缓存不存在。" }, { status: 404 });
    }
    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新翻译缓存失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
