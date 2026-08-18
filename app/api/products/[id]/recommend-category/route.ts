import { getProductById } from "@/lib/db";
import { recommendProductCategory } from "@/lib/mercadolibre/product-category-recommendation";
import { after, NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const product = getProductById(id);
  if (!product) {
    return NextResponse.json(
      { success: false, message: "商品不存在。" },
      { status: 404 },
    );
  }
  if (product.status === "category_recommending") {
    return NextResponse.json(
      { success: false, message: "该商品正在推荐分类，请稍候。" },
      { status: 409 },
    );
  }

  after(async () => {
    try {
      await recommendProductCategory(id);
    } catch (error) {
      console.error(`[category-recommendation] product=${id} background task failed`, error);
    }
  });
  return NextResponse.json({
    success: true,
    message: "已开始根据商品标题推荐分类。",
  });
}