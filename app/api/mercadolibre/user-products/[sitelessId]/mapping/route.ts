import { NextResponse } from "next/server";

import { getUPMapping } from "@/lib/mercadolibre/client";
import { getValidToken } from "@/lib/mercadolibre/token";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sitelessId: string }> }
) {
  try {
    const { sitelessId } = await params;
    if (!sitelessId) {
      return NextResponse.json(
        { success: false, message: "缺少 sitelessUserProductId。" },
        { status: 400 }
      );
    }

    const { token } = await getValidToken();
    const mapping = await getUPMapping(token, sitelessId);

    return NextResponse.json({
      success: true,
      data: mapping,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询 UP 映射失败。";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
