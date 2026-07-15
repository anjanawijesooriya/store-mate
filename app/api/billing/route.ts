import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const shopId = await getShopId();

    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: {
        billingStatus: true,
        isLifetime: true,
        planTier: true,
        smsBalance: true,
        trialEndsAt: true,
        gracePeriodEndsAt: true,
        nextBillingDate: true,
        maintenanceBanner: true,
        maintenanceBannerMessage: true,
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

    // Compute effective status in real-time so clients see LOCKED immediately
    // when the grace/trial period expires, even if the cron hasn't run yet.
    let effectiveStatus = shop.billingStatus;
    const now = new Date();
    // The persist is guarded on the current status (updateMany, not update) so a
    // payment webhook that set ACTIVE between our read and write is not clobbered
    // back to GRACE/LOCKED. effectiveStatus is what the client sees regardless.
    if (shop.billingStatus === "GRACE" && shop.gracePeriodEndsAt && now > shop.gracePeriodEndsAt) {
      effectiveStatus = "LOCKED";
      await db.shop.updateMany({ where: { id: shopId, billingStatus: "GRACE" }, data: { billingStatus: "LOCKED" } });
    } else if (shop.billingStatus === "TRIAL" && shop.trialEndsAt && now > shop.trialEndsAt) {
      effectiveStatus = "GRACE";
      const gracePeriodEndsAt = new Date(shop.trialEndsAt);
      gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + 3);
      await db.shop.updateMany({ where: { id: shopId, billingStatus: "TRIAL" }, data: { billingStatus: "GRACE", gracePeriodEndsAt } });
    }

    return Response.json({ billing: { ...shop, billingStatus: effectiveStatus } });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to fetch billing info", 500);
  }
}

