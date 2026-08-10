import { NextResponse } from "next/server";

import { getPublishedProductRows, type PublishedProductFilters } from "@/lib/mercadolibre/published-products";
import { getValidToken } from "@/lib/mercadolibre/token";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const statusValue = searchParams.get("status") || "active";
    const siteValue = searchParams.get("site") || "MLM";
    const allowedStatuses = ["active", "paused", "closed", "all"] as const;
    const allowedSites = ["MLM", "MLB", "CBT"] as const;
    if (!allowedStatuses.includes(statusValue as typeof allowedStatuses[number])) {
      return NextResponse.json({ success: false, message: "无效的商品状态。" }, { status: 400 });
    }
    if (!allowedSites.includes(siteValue as typeof allowedSites[number])) {
      return NextResponse.json({ success: false, message: "无效的站点。" }, { status: 400 });
    }
    const page = Math.max(Number.parseInt(searchParams.get("page") || "1", 10) || 1, 1);
    const filters: PublishedProductFilters = {
      status: statusValue as PublishedProductFilters["status"],
      siteId: siteValue as PublishedProductFilters["siteId"],
      keyword: searchParams.get("keyword")?.trim() || undefined,
      page,
      pageSize: 20,
    };
    const { token, mlUserId } = await getValidToken();
    const data = await getPublishedProductRows(token, mlUserId, filters);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "查询已上架商品失败。" },
      { status: 500 },
    );
  }
}