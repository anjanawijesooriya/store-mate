import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";
import { BillingStatus } from "@/lib/generated/prisma/enums";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return apiError("Unauthorized", 401);

  const { id: shopId } = await params;
  const body = await req.json().catch(() => ({}));
  const enable: boolean = !!body.enable;

  // Lifetime shops get 1 year free maintenance, then annual fee kicks in
  const maintenanceDueDate = new Date();
  maintenanceDueDate.getFullYear() && maintenanceDueDate.setFullYear(maintenanceDueDate.getFullYear() + 1);

  // When disabling lifetime, check prior subscription payment history so we
  // don't silently downgrade a shop that was already paying for a plan.
  let disableData: Record<string, unknown> = {
    isLifetime: false,
    nextBillingDate: null,
    gracePeriodEndsAt: null,
    maintenanceDueDate: null,
    maintenancePaidUntil: null,
  };

  if (!enable) {
    const lastPayment = await db.payment.findFirst({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      select: { planTier: true, createdAt: true },
    });

    if (lastPayment) {
      // Shop had a paid subscription — put them into GRACE so they can re-subscribe
      // rather than forcing them all the way back to a 7-day trial
      const graceEndsAt = new Date();
      graceEndsAt.setDate(graceEndsAt.getDate() + 5);
      disableData = {
        ...disableData,
        billingStatus: BillingStatus.GRACE,
        gracePeriodEndsAt: graceEndsAt,
        planTier: lastPayment.planTier,
      };
    } else {
      // No prior payments — treat as a fresh trial
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);
      disableData = {
        ...disableData,
        billingStatus: BillingStatus.TRIAL,
        trialEndsAt,
      };
    }
  }

  const shop = await db.shop.update({
    where: { id: shopId },
    data: enable
      ? {
          isLifetime: true,
          billingStatus: BillingStatus.ACTIVE,
          nextBillingDate: null,
          gracePeriodEndsAt: null,
          trialEndsAt: null,
          maintenanceDueDate,
          maintenancePaidUntil: null,
        }
      : disableData,
    select: { id: true, isLifetime: true, billingStatus: true },
  });

  return Response.json({ success: true, isLifetime: shop.isLifetime });
}
