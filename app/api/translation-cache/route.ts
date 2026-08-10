import { NextResponse } from "next/server";

import { listTranslationCache } from "@/lib/db";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 200;
const LOCALE_PATTERN = /^[A-Za-z][A-Za-z0-9-]{0,19}$/;

function readText(value: string | null, name: string, maxLength = MAX_TEXT_LENGTH) {
  const text = value?.trim() || "";
  if (text.length > maxLength) {
    throw new Error(`${name} 不能超过 ${maxLength} 个字符。`);
  }
  return text;
}

function readPositiveInt(value: string | null, fallback: number, max: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error("分页参数无效。");
  }
  return parsed;
}

function readLocale(value: string | null, name: string) {
  const locale = readText(value, name, 20);
  if (locale && !LOCALE_PATTERN.test(locale)) {
    throw new Error(`${name} 格式无效。`);
  }
  return locale;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = readPositiveInt(url.searchParams.get("page"), 1, 1_000_000);
    const pageSize = readPositiveInt(url.searchParams.get("pageSize"), 20, 100);
    const keyword = readText(url.searchParams.get("keyword"), "关键词");
    const sourceLocale = readLocale(url.searchParams.get("sourceLocale"), "源语言");
    const targetLocale = readLocale(url.searchParams.get("targetLocale"), "目标语言");
    const context = readText(url.searchParams.get("context"), "上下文");
    const version = readText(url.searchParams.get("version"), "版本", 50);

    return NextResponse.json(
      listTranslationCache({
        page,
        pageSize,
        keyword,
        sourceLocale,
        targetLocale,
        context,
        version,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询翻译缓存失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
