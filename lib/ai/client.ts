import { getAIModelById } from "@/lib/db";

export type AIImageResult = {
  mimeType: string;
  data: Buffer;
};

export type AIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIChatOptions = {
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
};

export type AIChatResponse = {
  content: string;
};

function isOpenRouterUrl(url: URL) {
  return url.hostname === "openrouter.ai" || url.hostname.endsWith(".openrouter.ai");
}

function getOpenRouterProviderPreferences() {
  const order = process.env.OPENROUTER_PROVIDER_ORDER
    ?.split(",")
    .map((provider) => provider.trim())
    .filter(Boolean);
  return order?.length
    ? { order, allow_fallbacks: true }
    : { allow_fallbacks: true };
}

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
    body.enable_thinking = false;
    body.reasoning = {"effort": "none"}
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: options.signal,
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
    signal: options.signal,
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

export async function editImageWithModel(
  modelId: number,
  image: Buffer,
  mimeType: string,
  fileName: string,
  prompt: string,
): Promise<AIImageResult> {
  const model = getAIModelById(modelId);
  if (!model) {
    throw new Error(`AI 模型不存在 (ID: ${modelId})。`);
  }
  if (model.protocol === "anthropic") {
    throw new Error("图片编辑暂不支持 Anthropic 模型。请选择 OpenAI Images 兼容模型。");
  }

  let url: URL;
  try {
    url = new URL(model.url);
  } catch {
    throw new Error(`AI 模型「${model.name}」的 URL 无效: ${model.url}`);
  }

  const systemPrompt = model.systemPrompt.trim();
  const combinedPrompt = [systemPrompt, prompt].filter(Boolean).join("\n\n");

  if (url.pathname.endsWith("/chat/completions")) {
    const sourceDataUrl = `data:${mimeType};base64,${image.toString("base64")}`;
    const openRouter = isOpenRouterUrl(url);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${model.apiKey}`,
    };
    if (openRouter) {
      headers["HTTP-Referer"] = process.env.APP_URL || "http://localhost:3000";
      headers["X-OpenRouter-Title"] = "1688 to Mercado Libre";
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model.modelName,
        modalities: ["text", "image"],
        ...(openRouter ? { provider: getOpenRouterProviderPreferences() } : {}),
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: sourceDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "");
      if (openRouter && response.status === 403 && /region/i.test(error)) {
        throw new Error(
          "OpenRouter 拒绝了当前服务端所在地区的图片模型请求。网页端可用不代表服务端出口地区可用；请设置 OPENROUTER_PROVIDER_ORDER 切换 provider，或让服务端使用与网页端相同的网络出口。",
        );
      }
      throw new Error(`图片生成 API 错误 (${response.status}): ${error}`);
    }

    const json = await response.json();
    const message = json.choices?.[0]?.message;
    const generatedImage = message?.images?.[0];
    const generatedUrl = generatedImage?.image_url?.url || generatedImage?.url;
    if (typeof generatedUrl === "string") {
      if (generatedUrl.startsWith("data:")) {
        const match = generatedUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          return { mimeType: match[1], data: Buffer.from(match[2], "base64") };
        }
      } else {
        const imageResponse = await fetch(generatedUrl);
        if (!imageResponse.ok) {
          throw new Error(`无法下载 AI 返回的图片 (${imageResponse.status})。`);
        }
        return {
          mimeType: imageResponse.headers.get("content-type")?.split(";")[0] || "image/png",
          data: Buffer.from(await imageResponse.arrayBuffer()),
        };
      }
    }

    throw new Error("OpenRouter 图片生成返回格式异常：缺少 message.images[0] 图片数据。");
  }

  const openRouter = isOpenRouterUrl(url);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${model.apiKey}`,
  };
  if (openRouter) {
    headers["HTTP-Referer"] = process.env.APP_URL || "http://localhost:3000";
    headers["X-OpenRouter-Title"] = "1688 to Mercado Libre";
  }
  const body: Record<string, unknown> = {
    model: model.modelName,
    prompt: combinedPrompt,
  };
  if (openRouter) {
    body.input_references = [
      {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${image.toString("base64")}`,
        },
      },
    ];
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "");
    throw new Error(`图片生成 API 错误 (${response.status}): ${error}`);
  }

  const json = await response.json();
  const result = json.data?.[0];
  if (typeof result?.b64_json === "string") {
    return {
      mimeType: "image/png",
      data: Buffer.from(result.b64_json, "base64"),
    };
  }

  if (typeof result?.url === "string") {
    const imageResponse = await fetch(result.url);
    if (!imageResponse.ok) {
      throw new Error(`无法下载 AI 返回的图片 (${imageResponse.status})。`);
    }
    return {
      mimeType: imageResponse.headers.get("content-type")?.split(";")[0] || "image/png",
      data: Buffer.from(await imageResponse.arrayBuffer()),
    };
  }

  throw new Error("图片生成 API 返回格式异常：缺少 data[0].url 或 data[0].b64_json。");
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
