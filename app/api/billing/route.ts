import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const shopId = await getShopId();

    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: {
        billingStatus: true,
        planTier: true,
        trialEndsAt: true,
        gracePeriodEndsAt: true,
        nextBillingDate: true,
        payments: {
          orderBy: { paidAt: "desc" },
          take: 12,
          select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            reference: true,
            planTier: true,
            billingMonth: true,
            note: true,
            paidAt: true,
          },
        },
      },
    });

    if (!shop) return apiError("Shop not found", 404);
    return Response.json({ billing: shop });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to fetch billing info", 500);
  }
}
