import path from "node:path";

import { OpenRouter } from "@openrouter/sdk";
import ExcelJS from "exceljs";

import { updateProduct } from "@/lib/db";
import { findNextWritableRow, getWorksheetOrThrow } from "@/lib/excel/template-fields";
import { parseProductBundle } from "@/lib/products";
import type { ExportJsonRecord, ParsedSkuItem, ProductListItem } from "@/lib/types";

type ExportedWorkbook = {
  fileName: string;
  buffer: Buffer;
  templatePath: string;
};

type ExportWorkbookOptions = {
  selectedSkuKeys?: string[];
  userPrompt?: string;
};

type SerializableCellValue = string | number | boolean | null;

type WorksheetPreviewRow = {
  rowNumber: number;
  cells: Array<{
    column: string;
    value: SerializableCellValue;
  }>;
};

type WorksheetContext = {
  workbookSheets: string[];
  sheetName: string;
  rowCount: number;
  columnCount: number;
  firstWritableRow: number;
  previewRows: WorksheetPreviewRow[];
};

type RequiredColumnHint = {
  column: string;
  purpose: "title";
  label: string;
};

type AiCellPlan = {
  column: string;
  value: SerializableCellValue;
};

type AiRowPlan = {
  rowOffset?: number;
  rowNumber?: number;
  cells?: AiCellPlan[];
};

type AiExportPlan = {
  records?: AiRowPlan[];
  notes?: string[];
};

const OPENROUTER_MODEL = "deepseek/deepseek-v4-flash";

const SYSTEM_PROMPT = [
  "你是一个 Excel 模板填表代理，负责根据工作表结构和商品 JSON 生成写入计划。",
  "你不能返回解释文字，不能返回 Markdown，不能返回代码块，只能返回 JSON 对象。",
  "你的输出格式必须是 {\"records\":[{\"rowOffset\":0,\"cells\":[{\"column\":\"B\",\"value\":\"...\"}]}],\"notes\":[\"...\"]}。",
  "rowOffset 是相对于 firstWritableRow 的偏移量；第一个待写入数据行必须用 rowOffset=0。",
  "如果选中了多个 SKU，通常应该生成多条 records，每个 SKU 一行，rowOffset 依次递增。",
  "如果没有 SKU，则只生成一条主商品记录。",
  "如果输入里提供了 requiredColumns，这些列就是强制必填列；每一条 record 都必须写入这些列，不能遗漏。",
  "当 requiredColumns 中 purpose=title 时，必须把商品标题写入对应列，并结合该列附近说明控制长度、语气和语言。",
  "同一个商品下的不同 SKU，标题必须保持一致；不要因为颜色、图案或其它变体差异为不同 SKU 生成不同标题，除非用户提示词明确要求区分。且不能超过60个字符。",
  "颜色列只能从当前 SKU 的 options、specAttrs 或其它明确的规格选项中选择一个最匹配的颜色值来填写；如果无法明确判断颜色，就留空，不要猜测。",
  "凡是需要填写自由文本、标题、卖点、属性值、描述、材质、颜色、尺寸说明等文字内容时，默认翻译成自然英文后再填写；除非模板或用户提示词明确要求保留原文。",
  "凡是表达是否、支持/不支持、有/无、可/不可、true/false 这类布尔含义的单元格，统一填写 Yes 或 No，不要填写中文或其他变体。",
  "品牌和型号如果原始值是中文，先转成拼音再填写；不要保留汉字。若原始值本身不是中文，则保持原语言中最合适的标准写法。",
  "只能填写你能从模板结构、商品 JSON、SKU JSON 和用户提示词中明确推断出的值；不允许臆造。",
  "对缺失、冲突或不确定的信息，直接留空，不要猜测。",
  "不要修改表头、说明行、公式示例或 firstWritableRow 之前的任何内容。",
  "不要输出不存在的列，不要使用 A1 这种完整单元格地址，只能输出列字母。",
  "如果模板结构不足以支持可靠填写，也必须返回 JSON，但 cells 可以为空，并在 notes 中说明原因。"
].join("\n");

function buildDownloadFileName(product: ProductListItem) {
  const base = `${product.categoryCode}-${product.offerId || product.id}-${product.title || "product"}`
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

  return `${base || product.id}.xlsx`;
}

function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() || process.env.API_KEY?.trim() || "";
  if (!apiKey) {
    throw new Error("未配置 OpenRouter API Key。请在 .env 中设置 OPENROUTER_API_KEY 或 API_KEY。");
  }

  return new OpenRouter({
    apiKey,
    httpReferer: "http://localhost:3000",
    appTitle: "1688 to Mercado Libre"
  });
}

function serializeCellValue(value: ExcelJS.CellValue): SerializableCellValue {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeCellValue(item as ExcelJS.CellValue)).filter((item) => item !== null).join(" | ");
  }

  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text || "").join("");
    }

    if ("result" in value) {
      return serializeCellValue(value.result as ExcelJS.CellValue);
    }

    if ("formula" in value && typeof value.formula === "string") {
      return `=${value.formula}`;
    }

    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return value.hyperlink;
    }
  }

  return JSON.stringify(value);
}

function collectWorksheetContext(workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet): WorksheetContext {
  const firstWritableRow = findNextWritableRow(worksheet, 6);
  const previewEndRow = Math.min(Math.max(firstWritableRow + 1, 8), Math.max(worksheet.rowCount, firstWritableRow + 1), 20);
  const previewRows: WorksheetPreviewRow[] = [];

  for (let rowNumber = 1; rowNumber <= previewEndRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const cells: WorksheetPreviewRow["cells"] = [];

    row.eachCell({ includeEmpty: false }, (cell) => {
      const value = serializeCellValue(cell.value);
      if (value === null || value === "") {
        return;
      }

      cells.push({
        column: cell.address.replace(/\d+/g, ""),
        value
      });
    });

    if (cells.length > 0) {
      previewRows.push({ rowNumber, cells });
    }
  }

  return {
    workbookSheets: workbook.worksheets.map((item) => item.name),
    sheetName: worksheet.name,
    rowCount: worksheet.rowCount,
    columnCount: worksheet.actualColumnCount,
    firstWritableRow,
    previewRows
  };
}

function sanitizeForAi(value: unknown, currentPath: string[] = [], depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    const currentKey = currentPath[currentPath.length - 1] || "";
    if (currentKey === "html") {
      return `[omitted html, ${value.length} chars]`;
    }

    return value.length > 4000 ? `${value.slice(0, 4000)}...[truncated ${value.length - 4000} chars]` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item, index) => sanitizeForAi(item, [...currentPath, String(index)], depth + 1));
  }

  if (typeof value === "object") {
    if (depth > 8) {
      return "[omitted deep object]";
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, sanitizeForAi(nestedValue, [...currentPath, key], depth + 1)])
    );
  }

  return String(value);
}

function extractCompletionText(completion: { choices?: Array<{ message?: { content?: unknown } }> }) {
  const content = completion.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  throw new Error("AI 未返回可解析的文本结果。");
}

function extractJsonPayload(text: string) {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || trimmed;
  const startIndex = candidate.indexOf("{");
  const endIndex = candidate.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("AI 返回内容中未找到 JSON 对象。");
  }

  return candidate.slice(startIndex, endIndex + 1);
}

function parseAiExportPlan(text: string): AiExportPlan {
  const payload = JSON.parse(extractJsonPayload(text)) as AiExportPlan;
  if (!payload || typeof payload !== "object") {
    throw new Error("AI 返回的 JSON 结构无效。");
  }

  if (!Array.isArray(payload.records)) {
    throw new Error("AI 返回的 JSON 缺少 records 数组。");
  }

  return payload;
}

function detectRequiredColumns(worksheetContext: WorksheetContext): RequiredColumnHint[] {
  const results = new Map<string, RequiredColumnHint>();

  for (const row of worksheetContext.previewRows) {
    if (row.rowNumber >= worksheetContext.firstWritableRow) {
      continue;
    }

    for (const cell of row.cells) {
      const normalizedValue = String(cell.value || "").replace(/\s+/g, " ").trim();
      if (!normalizedValue) {
        continue;
      }

      if (/(^|\b)title(\b|$)|标题/i.test(normalizedValue)) {
        results.set(cell.column, {
          column: cell.column,
          purpose: "title",
          label: normalizedValue
        });
      }
    }
  }

  return [...results.values()];
}

function findMissingRequiredColumns(plan: AiExportPlan, requiredColumns: RequiredColumnHint[]) {
  if (!requiredColumns.length) {
    return [] as string[];
  }

  const missing = new Set<string>();

  for (const record of plan.records || []) {
    const presentColumns = new Set(
      (record.cells || [])
        .map((cell) => normalizeColumn(cell.column))
        .filter(Boolean)
    );

    for (const hint of requiredColumns) {
      const requiredColumn = normalizeColumn(hint.column);
      if (!presentColumns.has(requiredColumn)) {
        missing.add(requiredColumn);
      }
    }
  }

  return [...missing];
}

async function requestAiExportPlan(input: {
  product: ProductListItem;
  worksheetContext: WorksheetContext;
  mainProduct: ExportJsonRecord;
  selectedSkuItems: ParsedSkuItem[];
  requiredColumns: RequiredColumnHint[];
  userPrompt?: string;
}) {
  const client = getOpenRouterClient();
  const payload = {
    category: {
      code: input.product.categoryCode,
      name: input.product.categoryName,
      templatePath: path.basename(input.product.categoryTemplatePath),
      sheetName: input.product.categorySheetName
    },
    worksheet: input.worksheetContext,
    productJson: {
      mainProduct: sanitizeForAi(input.mainProduct),
      selectedSkuItems: sanitizeForAi(
        input.selectedSkuItems.map((item) => ({
          key: item.key,
          skuId: item.skuId,
          label: item.label,
          imageUrl: item.imageUrl,
          product: item.product
        }))
      )
    },
    requiredColumns: input.requiredColumns,
    userPrompt: input.userPrompt?.trim() || null
  };

  const baseMessages = [
    {
      role: "system" as const,
      content: SYSTEM_PROMPT
    },
    {
      role: "user" as const,
      content: JSON.stringify(payload, null, 2)
    }
  ];

  const completion = await client.chat.send({
    chatRequest: {
      model: OPENROUTER_MODEL,
      messages: baseMessages
    }
  });

  let plan = parseAiExportPlan(extractCompletionText(completion));
  const missingRequiredColumns = findMissingRequiredColumns(plan, input.requiredColumns);

  if (!missingRequiredColumns.length) {
    return plan;
  }

  const repairCompletion = await client.chat.send({
    chatRequest: {
      model: OPENROUTER_MODEL,
      messages: [
        ...baseMessages,
        {
          role: "assistant",
          content: JSON.stringify(plan, null, 2)
        },
        {
          role: "user",
          content: JSON.stringify({
            instruction: "上一版写入计划遗漏了必填列。请返回完整修正版 JSON，保留原有正确单元格，并补齐所有 records 中缺失的 requiredColumns。",
            missingRequiredColumns,
            requiredColumns: input.requiredColumns
          }, null, 2)
        }
      ]
    }
  });

  plan = parseAiExportPlan(extractCompletionText(repairCompletion));

  const stillMissing = findMissingRequiredColumns(plan, input.requiredColumns);
  if (stillMissing.length) {
    throw new Error(`AI 返回的写入计划缺少必填列: ${stillMissing.join(", ")}。`);
  }

  return plan;
}

function normalizeColumn(column: string) {
  return String(column || "").trim().toUpperCase();
}

function applyAiPlan(worksheet: ExcelJS.Worksheet, firstWritableRow: number, plan: AiExportPlan) {
  let writtenCells = 0;

  for (const record of plan.records || []) {
    const rowOffset = Number.isInteger(record.rowOffset) ? Number(record.rowOffset) : null;
    const rowNumber = Number.isInteger(record.rowNumber) ? Number(record.rowNumber) : null;
    const targetRow = rowOffset !== null ? firstWritableRow + rowOffset : rowNumber;

    if (!targetRow || targetRow < firstWritableRow) {
      continue;
    }

    const cells = Array.isArray(record.cells) ? record.cells : [];
    const row = worksheet.getRow(targetRow);

    for (const cellPlan of cells) {
      const column = normalizeColumn(cellPlan.column);
      if (!/^[A-Z]{1,3}$/.test(column)) {
        continue;
      }

      row.getCell(column).value = cellPlan.value ?? "";
      writtenCells += 1;
    }

    row.commit();
  }

  if (writtenCells === 0) {
    throw new Error("AI 没有返回可写入的单元格，请调整提示词后重试。");
  }

  return writtenCells;
}

export async function exportProductWorkbook(
  product: ProductListItem,
  options: ExportWorkbookOptions = {}
): Promise<ExportedWorkbook> {
  const bundle = await parseProductBundle(product.extractedDir);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(product.categoryTemplatePath);

  const worksheet = getWorksheetOrThrow(workbook, product.categorySheetName);
  const selectedSkuSet = options.selectedSkuKeys?.length ? new Set(options.selectedSkuKeys) : null;
  const selectedSkuItems = selectedSkuSet
    ? bundle.skuItems.filter((item) => selectedSkuSet.has(item.key))
    : bundle.skuItems;

  if (bundle.skuItems.length > 0 && selectedSkuItems.length === 0) {
    throw new Error("请至少选择一个 SKU 后再导出。\n");
  }

  try {
    const worksheetContext = collectWorksheetContext(workbook, worksheet);
    const requiredColumns = detectRequiredColumns(worksheetContext);
    const plan = await requestAiExportPlan({
      product,
      worksheetContext,
      mainProduct: bundle.mainProduct,
      selectedSkuItems,
      requiredColumns,
      userPrompt: options.userPrompt
    });

    applyAiPlan(worksheet, worksheetContext.firstWritableRow, plan);
    const buffer = await workbook.xlsx.writeBuffer();

    updateProduct(product.id, {
      lastError: null,
      lastExportedAt: new Date().toISOString(),
      status: "ready"
    });

    return {
      fileName: buildDownloadFileName(product),
      buffer: Buffer.from(buffer),
      templatePath: path.basename(product.categoryTemplatePath)
    };
  } catch (error) {
    updateProduct(product.id, {
      status: "error",
      lastError: error instanceof Error ? error.message : "导出失败。"
    });
    throw error;
  }
}