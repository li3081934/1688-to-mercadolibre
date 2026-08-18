import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { NextResponse } from "next/server";
import { listAIModels } from "@/lib/db";

export const runtime = "nodejs";

type AttrDef = {
  id: string;
  name: string;
  value_type: string;
  tags?: Record<string, unknown>;
  values?: Array<{ id: string; name: string }> | null;
  hint?: string;
};

function extractJson(text: string): string {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  if (!cleaned.includes("{")) return "";

  const candidates: string[] = [];

  const allBracePositions: number[] = [];
  for (let pos = cleaned.indexOf("{"); pos !== -1; pos = cleaned.indexOf("{", pos + 1)) {
    allBracePositions.push(pos);
  }
  for (let idx = allBracePositions.length - 1; idx >= 0 && candidates.length < 3; idx--) {
    const i = allBracePositions[idx];
    let depth = 0;
    let valid = true;
    for (let j = i; j < cleaned.length; j++) {
      if (cleaned[j] === "{") depth++;
      else if (cleaned[j] === "}") depth--;
      if (depth === 0) {
        const candidate = cleaned.slice(i, j + 1);
        try {
          JSON.parse(candidate);
          return candidate;
        } catch {
          candidates.push(candidate);
          break;
        }
      }
      if (depth < 0) { valid = false; break; }
    }
    if (!valid) continue;
  }

  const start = cleaned.indexOf("{");
  if (start === -1) return "";
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") depth--;
    if (depth === 0) return cleaned.slice(start, i + 1);
  }
  return candidates[0] ?? "";
}

function buildZodSchema(attrs: AttrDef[]): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const attr of attrs) {
    let field: z.ZodTypeAny;
    const desc = attr.hint || attr.name;

    if (attr.values && attr.values.length > 0) {
      const options = attr.values.map((v) => v.name) as [string, ...string[]];
      field = z.enum(options);
    } else if (attr.value_type === "number_unit") {
      field = z.string().describe(`${desc} (e.g. "30 cm")`);
    } else {
      field = z.string();
    }

    field = field.describe(desc);

    if (attr.tags?.catalog_required || attr.tags?.required) {
      shape[attr.id] = field;
    } else {
      shape[attr.id] = field.optional();
    }
  }
  return z.object(shape);
}

export async function POST(request: Request) {
  try {
    const { attributes, product, categoryName } = await request.json() as {
      attributes: AttrDef[];
      product: { attributes?: Array<{ label: string; value: string }>; packageInfo?: unknown };
      categoryName?: string;
    };

    if (!attributes || !product) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    const models = listAIModels();
    const fillModel = models.find((m) => m.purpose === "fill_info");
    if (!fillModel) {
      return NextResponse.json({ error: "未找到 fill_info 模型，请先在 AI 模型管理配置。" }, { status: 404 });
    }

    const filteredAttrs = attributes.filter((a) => a.id !== "ITEM_CONDITION" && a.id !== "SELLER_SKU");
    const zodSchema = buildZodSchema(filteredAttrs);
    const jsonSchema = zodToJsonSchema(zodSchema, "attributes");

    const prompt = `Product attributes: ${JSON.stringify(product.attributes || [])}
Product packaging: ${JSON.stringify(product.packageInfo || {})}
Category: ${categoryName || ""}

JSON Schema of output (fill in values for ALL fields you can determine):
${JSON.stringify(jsonSchema, null, 2)}

Output ONLY a valid JSON object matching the schema. No explanation, no markdown, just the JSON.`;

    let result = "";
    let httpDebug: Record<string, unknown> = {};
    try {
      const url = fillModel.url;
      const apiKey = fillModel.apiKey;
      const systemPrompt = fillModel.systemPrompt || "You are a product attribute filler. Analyze the product data and fill the attribute schema. Output ONLY a valid JSON object matching the provided schema. No markdown, no explanation.";
      const body: Record<string, unknown> = {
        model: fillModel.modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        max_tokens: 32000,
        temperature: 0.3,
      };
      if (!fillModel.thinkingEnabled) {
        body.thinking = { type: "disabled" };
        body.enable_thinking = false;
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      httpDebug = { status: res.status, statusText: res.statusText };
      const text = await res.text();
      httpDebug.bodyPreview = text.slice(0, 500);
      if (!res.ok) {
        return NextResponse.json({ success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}`, debug: httpDebug });
      }
      const json = JSON.parse(text);
      const choice = json.choices?.[0]?.message;
      const content = (choice?.content ?? "").trim();
      const reasoning = (choice?.reasoning_content ?? "").trim();

      if (content) {
        result = extractJson(content);
      }
      if (!result && reasoning) {
        result = extractJson(reasoning);
      }
    } catch (err) {
      return NextResponse.json({
        success: false,
        error: `AI 调用异常: ${err instanceof Error ? err.message : "未知错误"}`,
        debug: { ...httpDebug, modelId: fillModel.id, modelName: fillModel.name, url: fillModel.url },
      });
    }

    if (!result) {
      return NextResponse.json({
        success: false,
        error: "AI 返回内容不含有效 JSON",
        debug: { ...httpDebug, modelId: fillModel.id, modelName: fillModel.name, url: fillModel.url, modelNameField: fillModel.modelName },
      });
    }

    const filled: Record<string, string> = JSON.parse(result);

    return NextResponse.json({ success: true, data: filled });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI 填写失败";
    return NextResponse.json({ success: false, error: message });
  }
}
