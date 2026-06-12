import path from "node:path";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getProductById } from "@/lib/db";
import { exportProductWorkbook } from "@/lib/excel/export-product";
import { getProductDir, ensureDirectory } from "@/lib/storage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const product = getProductById(id);

    if (!product) {
      return NextResponse.json({ error: "商品不存在。" }, { status: 404 });
    }

    const formData = await request.formData();
    const templateFile = formData.get("templateFile");
    const sheetName = String(formData.get("sheetName") || "Sheet1").trim();
    const userPrompt = String(formData.get("userPrompt") || "").trim();
    const selectedSkuKeys = formData.getAll("sku").map((value) => String(value || "").trim()).filter(Boolean);

    if (!(templateFile instanceof File) || templateFile.size === 0) {
      return NextResponse.json({ error: "请上传 Excel 模板文件。" }, { status: 400 });
    }

    const productDir = getProductDir(id);
    const tempDir = path.join(productDir, "temp");
    await ensureDirectory(tempDir);
    const templatePath = path.join(tempDir, `${randomUUID()}-template.xlsx`);

    const buffer = Buffer.from(await templateFile.arrayBuffer());
    const { writeFile } = await import("node:fs/promises");
    await writeFile(templatePath, buffer);

    const exported = await exportProductWorkbook(product, {
      templatePath,
      sheetName,
      selectedSkuKeys,
      userPrompt
    });

    return new NextResponse(new Uint8Array(exported.buffer), {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(exported.fileName)}`
      }
    });
  } catch (error) {
    console.error("AI 导出失败:", error);
    const message = error instanceof Error ? error.message : `导出失败: ${String(error)}`;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
