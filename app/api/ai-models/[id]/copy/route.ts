import { NextResponse } from "next/server";
import { createAIModel, getAIModelById } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const model = getAIModelById(Number(id));
  if (!model) {
    return NextResponse.json({ error: "AI 模型不存在。" }, { status: 404 });
  }

  const now = new Date().toISOString();
  createAIModel({
    name: `${model.name}-copy`,
    url: model.url,
    apiKey: model.apiKey,
    modelName: model.modelName,
    systemPrompt: model.systemPrompt,
    protocol: model.protocol,
    thinkingEnabled: !!model.thinkingEnabled,
    purpose: model.purpose,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ success: true });
}
