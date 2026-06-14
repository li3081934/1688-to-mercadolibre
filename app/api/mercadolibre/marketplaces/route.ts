import { NextResponse } from "next/server";
import { getMarketplaceUsers } from "@/lib/mercadolibre/client";
import { getValidToken } from "@/lib/mercadolibre/token";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { token, mlUserId } = await getValidToken();
    const data = await getMarketplaceUsers(token, mlUserId);

    const sites = data.marketplaces
      .filter((m) => m.logistic_type !== "fulfillment")
      .map((m) => ({
        siteId: m.site_id,
        logisticType: m.logistic_type,
      }));

    return NextResponse.json({ success: true, data: sites });
  } catch (err) {
    const message = err instanceof Error ? err.message : "查询站点失败";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
