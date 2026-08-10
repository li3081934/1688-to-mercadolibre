import { NextResponse } from "next/server";
import { deleteAIModel, getAIModelById, updateAIModel } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const model = getAIModelById(Number(id));
  if (!model) {
    return NextResponse.json({ error: "AI 模型不存在。" }, { status: 404 });
  }
  const { apiKey: _, ...rest } = model;
  return NextResponse.json(rest);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  try {
    const patch: Record<string, string | number | boolean> = {
      name: body.name,
      url: body.url,
      modelName: body.modelName,
      systemPrompt: body.systemPrompt || "",
      protocol: body.protocol,
      thinkingEnabled: !!body.thinkingEnabled,
      purpose: body.purpose,
    };
    if (body.apiKey) {
      patch.apiKey = body.apiKey;
    }
    updateAIModel(Number(id), patch);
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `更新失败: ${message}` }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteAIModel(Number(id));
  return NextResponse.json({ success: true });
}
