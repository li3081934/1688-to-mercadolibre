import { getAIModelById } from "@/lib/db";

export type AIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIChatOptions = {
  maxTokens?: number;
  temperature?: number;
};

export type AIChatResponse = {
  content: string;
};

async function callOpenAI(
  url: string,
  apiKey: string,
  modelName: string,
  messages: AIChatMessage[],
  options: AIChatOptions & { thinkingEnabled?: boolean },
): Promise<string> {
  const body: Record<string, unknown> = {
    model: modelName,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
  };
  if (options.thinkingEnabled === false) {
    body.thinking = { type: "disabled" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenAI API 错误 (${res.status}): ${err}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI 返回格式异常：缺少 choices[0].message.content");
  }
  return content;
}

async function callAnthropic(
  url: string,
  apiKey: string,
  modelName: string,
  messages: AIChatMessage[],
  options: AIChatOptions,
): Promise<string> {
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    model: modelName,
    messages: nonSystemMessages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
  };

  if (systemMessages.length > 0) {
    body.system = systemMessages.map((m) => m.content).join("\n");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Anthropic API 错误 (${res.status}): ${err}`);
  }

  const json = await res.json();
  const contentBlock = json.content?.[0];
  const content = contentBlock?.text;
  if (typeof content !== "string") {
    throw new Error("Anthropic 返回格式异常：缺少 content[0].text");
  }
  return content;
}

export async function chatWithModel(
  modelId: number,
  messages: AIChatMessage[],
  options: AIChatOptions = {},
): Promise<AIChatResponse> {
  const model = getAIModelById(modelId);
  if (!model) {
    throw new Error(`AI 模型不存在 (ID: ${modelId})。`);
  }

  let url: URL;
  try {
    url = new URL(model.url);
  } catch {
    throw new Error(`AI 模型「${model.name}」的 URL 无效: ${model.url}`);
  }

  let content: string;

  if (model.protocol === "anthropic") {
    content = await callAnthropic(
      url.href,
      model.apiKey,
      model.modelName,
      messages,
      options,
    );
  } else {
      content = await callOpenAI(
        url.href,
        model.apiKey,
        model.modelName,
        messages,
        { ...options, thinkingEnabled: !!model.thinkingEnabled },
      );
  }

  return { content };
}
