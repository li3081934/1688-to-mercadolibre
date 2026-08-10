import path from "node:path";

import AdmZip from "adm-zip";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EXTENSION_DIR = path.join(process.cwd(), "extension");

export async function GET() {
  try {
    const zip = new AdmZip();
    zip.addLocalFolder(EXTENSION_DIR);
    const buffer = zip.toBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition":
          "attachment; filename*=UTF-8''extension.zip",
      },
    });
  } catch (error) {
    console.error("打包扩展失败:", error);
    const message =
      error instanceof Error ? error.message : "打包扩展失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
