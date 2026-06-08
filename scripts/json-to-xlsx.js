const fs = require("node:fs/promises");
const path = require("node:path");
const ExcelJS = require("exceljs");

const DEFAULT_TEMPLATE_PATH = path.resolve(__dirname, "..", "docs", "List-06-05-06_21_03.xlsx");
const DEFAULT_OUTPUT_PATH = path.resolve(__dirname, "..", "output", "mercado-libre-filled.xlsx");
const DEFAULT_SHEET_NAME = "Screwdrivers";
const DEFAULT_START_ROW = 6;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const jsonPaths = await resolveJsonPaths(options.jsonPaths);

  if (!jsonPaths.length) {
    throw new Error("未找到可写入的 JSON 文件。请通过 --json 指定文件，或把 JSON 放在项目根目录。");
  }

  const records = await Promise.all(jsonPaths.map(loadJsonRecord));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(options.templatePath);

  const worksheet = workbook.getWorksheet(options.sheetName);
  if (!worksheet) {
    throw new Error(`未找到工作表: ${options.sheetName}`);
  }

  let nextRowNumber = findNextWritableRow(worksheet, options.startRow);
  for (const record of records) {
    writeRecordToWorksheet(worksheet, nextRowNumber, record);
    nextRowNumber += 1;
  }

  await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
  await workbook.xlsx.writeFile(options.outputPath);

  console.log(`Wrote ${records.length} record(s) to ${options.outputPath}`);
}

function parseArgs(args) {
  const options = {
    jsonPaths: [],
    templatePath: DEFAULT_TEMPLATE_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    sheetName: DEFAULT_SHEET_NAME,
    startRow: DEFAULT_START_ROW
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      options.jsonPaths.push(path.resolve(args[index + 1]));
      index += 1;
      continue;
    }

    if (arg === "--template") {
      options.templatePath = path.resolve(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--output") {
      options.outputPath = path.resolve(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--sheet") {
      options.sheetName = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--start-row") {
      options.startRow = Number.parseInt(args[index + 1], 10);
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`未知参数: ${arg}`);
  }

  if (!Number.isInteger(options.startRow) || options.startRow < 1) {
    throw new Error("--start-row 必须是大于 0 的整数。");
  }

  return options;
}

function printHelp() {
  console.log([
    "Usage: npm run json-to-xlsx -- [options]",
    "",
    "Options:",
    "  --json <path>       JSON 文件路径，可重复传入多次",
    "  --template <path>   Excel 模板路径，默认 docs/List-06-05-06_21_03.xlsx",
    "  --output <path>     输出 xlsx 路径，默认 output/mercado-libre-filled.xlsx",
    "  --sheet <name>      工作表名称，默认 Screwdrivers",
    "  --start-row <num>   起始写入行，默认 6"
  ].join("\n"));
}

async function resolveJsonPaths(cliJsonPaths) {
  if (cliJsonPaths.length) {
    return cliJsonPaths;
  }

  const rootDir = path.resolve(__dirname, "..");
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(rootDir, entry.name))
    .sort();
}

async function loadJsonRecord(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.templateFields)) {
    throw new Error(`JSON 缺少 templateFields: ${filePath}`);
  }

  return {
    filePath,
    source: parsed.source || {},
    templateFields: parsed.templateFields
  };
}

function findNextWritableRow(worksheet, startRow) {
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

function writeRecordToWorksheet(worksheet, rowNumber, record) {
  const row = worksheet.getRow(rowNumber);

  for (const field of record.templateFields) {
    row.getCell(field.column).value = field.value ?? "";
  }

  row.commit();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});