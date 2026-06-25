import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

const SMS_PREFS_SELECT = {
  smsLowStock: true,
  smsDailySummary: true,
  smsReceiptEnabled: true,
  smsMonthlyUsage: true,
} as const;

export async function GET() {
  try {
    const shopId = await getShopId();
    const shop = await db.shop.findUnique({ where: { id: shopId }, select: SMS_PREFS_SELECT });
    if (!shop) return apiError("Shop not found", 404);
    return Response.json({ preferences: shop });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to fetch SMS preferences", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const body = await req.json();
    const { smsLowStock, smsDailySummary, smsReceiptEnabled } = body;

    const shop = await db.shop.update({
      where: { id: shopId },
      data: {
        ...(smsLowStock !== undefined && { smsLowStock: Boolean(smsLowStock) }),
        ...(smsDailySummary !== undefined && { smsDailySummary: Boolean(smsDailySummary) }),
        ...(smsReceiptEnabled !== undefined && { smsReceiptEnabled: Boolean(smsReceiptEnabled) }),
      },
      select: SMS_PREFS_SELECT,
    });

    return Response.json({ preferences: shop });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to update SMS preferences", 500);
  }
}
