import { NextResponse } from "next/server";
import { createAIModel, listAIModels } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const models = listAIModels().map(({ apiKey: _, ...rest }) => rest);
  return NextResponse.json(models);
}

export async function POST(request: Request) {
  const body = await request.json();
  const now = new Date().toISOString();
  createAIModel({
    name: body.name,
    url: body.url,
    apiKey: body.apiKey,
    modelName: body.modelName,
    systemPrompt: body.systemPrompt || "",
    protocol: body.protocol || "openai",
    thinkingEnabled: !!body.thinkingEnabled,
    purpose: body.purpose,
    createdAt: now,
    updatedAt: now,
  });
  return NextResponse.json({ success: true });
}
