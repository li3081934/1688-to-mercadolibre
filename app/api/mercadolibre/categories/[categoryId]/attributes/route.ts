import { NextResponse } from "next/server";
import { getCategoryAttributes } from "@/lib/mercadolibre/client";
import { getValidToken } from "@/lib/mercadolibre/token";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{ categoryId: string }>;
};

export async function GET(_request: Request, context: RouteParams) {
  const { categoryId } = await context.params;

  try {
    const { token } = await getValidToken();
    const attributes = await getCategoryAttributes(categoryId, token);
    return NextResponse.json({ success: true, data: attributes });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "查询分类属性失败。",
      },
      { status: 500 }
    );
  }
}