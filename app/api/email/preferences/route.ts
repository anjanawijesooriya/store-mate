import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

const ALLOWED = new Set(["emailLowStock", "emailDailySummary", "emailReceiptEnabled", "creditReminderEnabled"]);

export async function PATCH(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const body   = await req.json();

    const data: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(body)) {
      if (ALLOWED.has(key) && typeof val === "boolean") data[key] = val;
    }
    if (Object.keys(data).length === 0) return apiError("No valid fields provided");

    const shop = await db.shop.update({ where: { id: shopId }, data });
    return Response.json({ shop });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to update email preferences", 500);
  }
}
