import { NextResponse } from "next/server";

import { getValidToken } from "@/lib/mercadolibre/token";
import { mlFetch } from "@/lib/mercadolibre/client";

export async function PUT(
  request: Request,
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
    const body = await request.json();

    const result = await mlFetch(
      `/global/user-products/${sitelessId}`,
      token,
      {
        method: "PUT",
        body: JSON.stringify(body),
      }
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "更新 UP 失败。";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
