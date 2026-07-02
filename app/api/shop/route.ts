import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const shopId = await getShopId();
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true, name: true, ownerName: true, phone: true,
        category: true, address: true, planTier: true, trialEndsAt: true,
        billingStatus: true, gracePeriodEndsAt: true, nextBillingDate: true,
        smsAddonEnabled: true, smsLowStock: true, smsDailySummary: true, smsReceiptEnabled: true, smsCredits: true,
      },
    });
    if (!shop) return apiError("Shop not found", 404);
    return Response.json({ shop });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to fetch shop", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const body = await req.json();
    const { name, ownerName, address } = body;

    const shop = await db.shop.update({
      where: { id: shopId },
      data: {
        ...(name && { name: name.trim() }),
        ...(ownerName && { ownerName: ownerName.trim() }),
        ...(address !== undefined && { address: address?.trim() || null }),
      },
    });

    return Response.json({ shop });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to update shop", 500);
  }
}

