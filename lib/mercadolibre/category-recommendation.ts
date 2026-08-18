import { listAIModels, listMLCategoryChildren, listMLCategoryRoots } from "@/lib/db";
import { chatWithModel } from "@/lib/ai/client";
import { CATEGORY_SITE_ID } from "@/lib/mercadolibre/categories";

const MAX_DEPTH = 20;
const REQUEST_TIMEOUT_MS = 45_000;

type Candidate = {
  categoryId: string;
  name: string;
  displayName: string;
  hasChildren: boolean;
};

type RecommendationResponse = {
  categoryId?: unknown;
  reason?: unknown;
};

export class CategoryRecommendationInputError extends Error {
  statusCode = 400;
}

export type CategoryRecommendation = {
  categoryId: string;
  name: string;
  displayName: string;
  pathFromRoot: Array<{ id: string; name: string }>;
  depth: number;
  reason?: string;
};

function extractJson(content: string): RecommendationResponse {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  const jsonText = fenced || content.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) throw new Error("AI 未返回有效 JSON。");
  try {
    return JSON.parse(jsonText) as RecommendationResponse;
  } catch {
    throw new Error("AI 返回的分类推荐 JSON 无法解析。");
  }
}

function buildUserPrompt(
  title: string,
  path: Array<{ id: string; name: string }>,
  candidates: Candidate[],
) {
  return [
    "请根据商品标题，从候选分类中选择最匹配的一个。",
    "只能选择 candidates 中已有的 categoryId，不要创建或修改 ID。",
    "如果当前候选都是上层分类，请选择最适合继续细分的分类；只要选择叶子分类即可结束。",
    "请只返回 JSON：{\"categoryId\":\"候选 ID\",\"reason\":\"不超过 30 字的简短理由\"}",
    JSON.stringify({ productTitle: title, currentPath: path, candidates }),
  ].join("\n");
}

export async function recommendCategoryByTitle(title: string): Promise<CategoryRecommendation> {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error("商品标题不能为空。");

  const model = listAIModels().find((item) => item.purpose === "category_recommendation");
  if (!model) {
    throw new CategoryRecommendationInputError("尚未配置“Mercado Libre 分类推荐”AI 模型，请先到 AI 模型页面配置。");
  }

  let currentPath: Array<{ id: string; name: string }> = [];
  let candidates = listMLCategoryRoots(CATEGORY_SITE_ID).map((category) => ({
    categoryId: category.categoryId,
    name: category.name,
    displayName: category.displayName,
    hasChildren: category.hasChildren,
  }));
  if (candidates.length === 0) {
    throw new CategoryRecommendationInputError("本地 CBT 分类树为空，请先到分类管理页面同步分类。");
  }

  const visited = new Set<string>();
  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    const candidateMap = new Map(candidates.map((candidate) => [candidate.categoryId, candidate]));
    const recommendation = await chatForCategory(model.id, [
      {
        role: "system",
        content: "你是 Mercado Libre CBT 商品分类专家。你必须严格从用户提供的 candidates 中选择一个分类。不能臆造分类 ID，不能返回候选之外的 ID，不能输出 JSON 以外的内容。优先依据商品实际主体判断，不要被品牌、型号、促销词或包装词误导。",
      },
      { role: "user", content: buildUserPrompt(normalizedTitle, currentPath, candidates) },
    ]);
    if (typeof recommendation.categoryId !== "string") {
      throw new Error("AI 返回中缺少 categoryId。");
    }
    const selected = candidateMap.get(recommendation.categoryId);
    if (!selected) {
      throw new Error(`AI 返回了当前候选之外的分类 ID：${recommendation.categoryId}`);
    }
    if (visited.has(selected.categoryId)) {
      throw new Error(`AI 重复选择分类 ${selected.categoryId}，无法继续细分。`);
    }
    visited.add(selected.categoryId);
    currentPath = [...currentPath, { id: selected.categoryId, name: selected.name }];
    const childRows = listMLCategoryChildren(CATEGORY_SITE_ID, selected.categoryId);
    console.info(
      `[category-recommendation] depth=${depth + 1}, selected=${selected.categoryId}, `
        + `declaredHasChildren=${selected.hasChildren}, actualChildren=${childRows.length}`,
    );
    if (childRows.length === 0) {
      return {
        categoryId: selected.categoryId,
        name: selected.name,
        displayName: selected.displayName,
        pathFromRoot: currentPath,
        depth: depth + 1,
        reason: typeof recommendation.reason === "string" ? recommendation.reason : undefined,
      };
    }
    candidates = childRows.map((category) => ({
      categoryId: category.categoryId,
      name: category.name,
      displayName: category.displayName,
      hasChildren: category.hasChildren,
    }));
  }

  throw new Error(`分类推荐超过最大层级 ${MAX_DEPTH}，未能找到叶子分类。`);
}

async function chatForCategory(
  modelId: number,
  messages: Array<{ role: "system" | "user"; content: string }>,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await chatWithModel(modelId, messages, {
        maxTokens: 300,
        temperature: 0.1,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return extractJson(result.content);
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || error.message !== "AI 未返回有效 JSON。") {
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI 未返回有效 JSON。");
}