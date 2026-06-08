import path from "node:path";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Script } from "node:vm";

import type ExcelJS from "exceljs";
import type { Worksheet } from "exceljs";

import { findNextWritableRow, getWorksheetOrThrow, writeTemplateFieldsRow, writeTemplateFieldsRows } from "@/lib/excel/template-fields";
import type { CategoryRecord, ExportJsonRecord, ProductListItem, TemplateField } from "@/lib/types";

export type CategoryMapperContext = {
  workbook: ExcelJS.Workbook;
  category: CategoryRecord;
  product: ProductListItem;
  mainProduct: ExportJsonRecord;
  skuProducts: ExportJsonRecord[];
  extractedDir: string;
  sharedImagesDir: string | null;
  sharedImagePaths: string[];
  helpers: {
    getWorksheetOrThrow: (workbook: ExcelJS.Workbook, sheetName: string) => Worksheet;
    findNextWritableRow: (worksheet: Worksheet, startRow?: number) => number;
    writeTemplateFieldsRow: (worksheet: Worksheet, rowNumber: number, templateFields: TemplateField[]) => void;
    writeTemplateFieldsRows: (worksheet: Worksheet, startRow: number, records: TemplateField[][]) => number;
  };
};

export type CategoryMapper = (context: CategoryMapperContext) => Promise<void> | void;

const requireModule = createRequire(import.meta.url);

async function loadCommonJsModule(modulePath: string) {
  const source = await readFile(modulePath, "utf8");
  const localRequire = createRequire(modulePath);
  const moduleRecord = { exports: {} as Record<string, unknown> };
  const wrappedSource = `(function (exports, require, module, __filename, __dirname) {${source}\n})`;
  const script = new Script(wrappedSource, { filename: modulePath });
  const compiledWrapper = script.runInThisContext() as (
    exports: Record<string, unknown>,
    require: NodeRequire,
    module: { exports: Record<string, unknown> },
    __filename: string,
    __dirname: string
  ) => void;

  compiledWrapper(moduleRecord.exports, localRequire, moduleRecord, modulePath, path.dirname(modulePath));
  return moduleRecord.exports;
}

function pickMapperFunction(loadedModule: Record<string, unknown>) {
  if (typeof loadedModule.mapProductToWorkbook === "function") {
    return loadedModule.mapProductToWorkbook as CategoryMapper;
  }

  if (typeof loadedModule.default === "function") {
    return loadedModule.default as CategoryMapper;
  }

  if (loadedModule.default && typeof loadedModule.default === "object") {
    const nestedDefault = loadedModule.default as Record<string, unknown>;
    if (typeof nestedDefault.mapProductToWorkbook === "function") {
      return nestedDefault.mapProductToWorkbook as CategoryMapper;
    }
  }

  throw new Error("mapper 文件必须导出 mapProductToWorkbook(context) 函数。");
}

export async function loadCategoryMapper(mapperPath: string) {
  const extension = path.extname(mapperPath).toLowerCase();

  let loadedModule: Record<string, unknown>;
  if (extension === ".mjs") {
    loadedModule = (await import(`${pathToFileURL(mapperPath).href}?t=${Date.now()}`)) as Record<string, unknown>;
  } else {
    loadedModule = await loadCommonJsModule(mapperPath);
  }

  return pickMapperFunction(loadedModule);
}

export async function validateCategoryMapper(mapperPath: string) {
  await loadCategoryMapper(mapperPath);
}

export const mapperHelpers = {
  getWorksheetOrThrow,
  findNextWritableRow,
  writeTemplateFieldsRow,
  writeTemplateFieldsRows
};