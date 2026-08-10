import { getTranslationCache, saveTranslationCache } from "@/lib/db";
import { chatWithModel } from "@/lib/ai/client";
import { listAIModels } from "@/lib/db";

const SOURCE_LOCALE = "en";
const TARGET_LOCALE = "zh-CN";
const TRANSLATION_VERSION = "v1";

const COMMON_TRANSLATIONS: Record<string, string> = {
  active: "已上架",
  brand: "品牌",
  color: "颜色",
  condition: "成色",
  dimensions: "尺寸",
  height: "高度",
  length: "长度",
  material: "材质",
  model: "型号",
  power: "功率",
  rechargeable: "可充电",
  size: "尺寸",
  type: "类型",
  voltage: "电压",
  warranty: "保修",
  weight: "重量",
  width: "宽度",
};

type TranslationItem = {
  text: string;
  context?: string;
};

export type TranslatedText = {
  source: string;
  translated: string;
  sourceType: "dictionary" | "cache" | "ai" | "fallback";
};

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function getDictionaryTranslation(text: string) {
  return COMMON_TRANSLATIONS[text.toLowerCase()] || null;
}

function parseBatchResponse(content: string, expectedTexts: string[]) {
  const jsonText = content.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) return null;
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const result = new Map<string, string>();
  for (const text of expectedTexts) {
    const value = parsed[text];
    if (typeof value === "string" && value.trim()) result.set(text, value.trim());
  }
  return result;
}

async function translateWithAI(texts: string[]) {
  const model = listAIModels().find((item) => item.purpose === "translation");
  if (!model || texts.length === 0) return new Map<string, string>();

  const prompt = [
    "Translate the following Mercado Libre category and attribute texts into Simplified Chinese.",
    "Return ONLY a JSON object where each exact input text is a key and the Chinese translation is its value.",
    "Preserve brand names, model numbers, units, abbreviations, and numbers.",
    JSON.stringify(texts),
  ].join("\n");
  const response = await chatWithModel(model.id, [
    { role: "system", content: "You are a precise product taxonomy translator." },
    { role: "user", content: prompt },
  ], { maxTokens: Math.max(2000, texts.length * 80), temperature: 0.1 });
  return parseBatchResponse(response.content, texts) || new Map<string, string>();
}

export async function translateTexts(items: TranslationItem[]): Promise<TranslatedText[]> {
  const normalized = items
    .map((item) => ({ text: normalizeText(item.text), context: item.context || "" }))
    .filter((item) => item.text);
  const result = new Map<string, TranslatedText>();
  const pending: Array<{ text: string; context: string }> = [];

  for (const item of normalized) {
    const key = `${item.context}\u0000${item.text}`;
    if (result.has(key)) continue;
    const dictionary = getDictionaryTranslation(item.text);
    if (dictionary) {
      result.set(key, { source: item.text, translated: dictionary, sourceType: "dictionary" });
      continue;
    }
    const cached = getTranslationCache(SOURCE_LOCALE, TARGET_LOCALE, item.text, item.context, TRANSLATION_VERSION);
    if (cached) {
      result.set(key, { source: item.text, translated: cached.translatedText, sourceType: "cache" });
      continue;
    }
    pending.push(item);
  }

  if (pending.length > 0) {
    try {
      const aiTranslations = await translateWithAI(pending.map((item) => item.text));
      for (const item of pending) {
        const translated = aiTranslations.get(item.text);
        const key = `${item.context}\u0000${item.text}`;
        if (!translated) {
          result.set(key, { source: item.text, translated: item.text, sourceType: "fallback" });
          continue;
        }
        saveTranslationCache({
          sourceLocale: SOURCE_LOCALE,
          targetLocale: TARGET_LOCALE,
          sourceText: item.text,
          translatedText: translated,
          context: item.context,
          version: TRANSLATION_VERSION,
        });
        result.set(key, { source: item.text, translated, sourceType: "ai" });
      }
    } catch {
      for (const item of pending) {
        result.set(`${item.context}\u0000${item.text}`, {
          source: item.text,
          translated: item.text,
          sourceType: "fallback",
        });
      }
    }
  }

  return normalized.map((item) => result.get(`${item.context}\u0000${item.text}`) || {
    source: item.text,
    translated: item.text,
    sourceType: "fallback",
  });
}