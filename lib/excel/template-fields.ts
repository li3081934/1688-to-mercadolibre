import type { Workbook, Worksheet } from "exceljs";

import type { TemplateField } from "@/lib/types";

export function getWorksheetOrThrow(workbook: Workbook, sheetName: string) {
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new Error(`未找到工作表: ${sheetName}`);
  }

  return worksheet;
}

export function findNextWritableRow(worksheet: Worksheet, startRow = 6) {
  let rowNumber = startRow;

  while (true) {
    const row = worksheet.getRow(rowNumber);
    const titleValue = row.getCell("B").value;
    const hasTitle = titleValue !== null && titleValue !== undefined && String(titleValue).trim() !== "";

    if (!hasTitle) {
      return rowNumber;
    }

    rowNumber += 1;
  }
}

export function writeTemplateFieldsRow(worksheet: Worksheet, rowNumber: number, templateFields: TemplateField[]) {
  const row = worksheet.getRow(rowNumber);

  for (const field of templateFields) {
    row.getCell(field.column).value = field.value ?? "";
  }

  row.commit();
}

export function writeTemplateFieldsRows(worksheet: Worksheet, startRow: number, records: TemplateField[][]) {
  let rowNumber = startRow;

  for (const templateFields of records) {
    writeTemplateFieldsRow(worksheet, rowNumber, templateFields);
    rowNumber += 1;
  }

  return rowNumber;
}