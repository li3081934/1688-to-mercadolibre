import { NextResponse } from "next/server";
import { listAIModels } from "@/lib/db";
import { chatWithModel } from "@/lib/ai/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { text } = await request.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "请提供要翻译的文本。" }, { status: 400 });
  }

  const models = listAIModels();
  const translateModel = models.find((m) => m.purpose === "translation");

  if (!translateModel) {
    return NextResponse.json({ error: "未找到翻译用途的 AI 模型，请先在 AI 模型管理中配置。" }, { status: 404 });
  }

  const systemPrompt = translateModel.systemPrompt || "请直接翻译用户输入的内容。";

  const result = await chatWithModel(translateModel.id, [
    { role: "system", content: systemPrompt },
    { role: "user", content: text },
  ]);

  return NextResponse.json({ translated: result.content.trim() });
}
