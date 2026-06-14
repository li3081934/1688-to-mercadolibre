import { NextResponse } from "next/server";
import { getMLAccount, updateMLAccountTags } from "@/lib/db";
import { getMarketplaceUsers, getUser } from "@/lib/mercadolibre/client";
import { getValidToken } from "@/lib/mercadolibre/token";

export const runtime = "nodejs";

export async function GET() {
  try {
    const account = getMLAccount();
    if (!account) {
      return NextResponse.json(
        { success: false, message: "未授权，请先登录美客多账号。" },
        { status: 401 }
      );
    }

    const { token, mlUserId } = await getValidToken();

    // 1. 获取 CBT 父账号 tags
    const parentUser = await getUser(token);
    const allTags = new Set(parentUser.tags ?? []);

    // 2. 获取各子站点卖家账号 tags
    try {
      const marketplaceData = await getMarketplaceUsers(token, mlUserId);
      for (const m of marketplaceData.marketplaces) {
        try {
          const childUser = await getUser(token, m.user_id);
          for (const tag of childUser.tags ?? []) {
            allTags.add(tag);
          }
        } catch {
          // 单个子站点查询失败不影响整体
        }
      }
    } catch {
      // marketplace 查询失败不影响父账号标签
    }

    const tags = Array.from(allTags);
    updateMLAccountTags(account.mlUserId, tags);

    return NextResponse.json({
      success: true,
      data: {
        parentTags: parentUser.tags ?? [],
        allTags: tags,
        isUserProductSeller: tags.includes("user_product_seller"),
        userType: parentUser.user_type,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取用户标签失败。";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
