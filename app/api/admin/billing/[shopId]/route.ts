import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";
import { BillingStatus, PlanTier } from "@/lib/generated/prisma/enums";

const GRACE_DAYS = 5;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  if (!(await isAdmin())) return apiError("Forbidden", 403);

  const { shopId } = await params;
  const body = await req.json();
  const { action } = body;

  if (action === "mark_paid") {
    const { amount, planTier, billingMonth, reference, note } = body;
    if (!amount || !planTier || !billingMonth) {
      return apiError("amount, planTier and billingMonth are required");
    }

    const nextBilling = new Date(billingMonth);
    nextBilling.setMonth(nextBilling.getMonth() + 1);
    nextBilling.setDate(1);

    const [shop] = await db.$transaction([
      db.shop.update({
        where: { id: shopId },
        data: {
          billingStatus: BillingStatus.ACTIVE,
          planTier: planTier as PlanTier,
          nextBillingDate: nextBilling,
          gracePeriodEndsAt: null,
        },
      }),
      db.payment.create({
        data: {
          shopId,
          amount,
          planTier: planTier as PlanTier,
          billingMonth,
          reference: reference ?? null,
          note: note ?? null,
          method: "MANUAL",
        },
      }),
    ]);

    return Response.json({ shop });
  }

  if (action === "change_plan") {
    const { planTier } = body;
    if (!planTier) return apiError("planTier is required");
    const shop = await db.shop.update({
      where: { id: shopId },
      data: { planTier: planTier as PlanTier },
    });
    return Response.json({ shop });
  }

  if (action === "lock") {
    const shop = await db.shop.update({
      where: { id: shopId },
      data: { billingStatus: BillingStatus.LOCKED, gracePeriodEndsAt: null },
    });
    return Response.json({ shop });
  }

  if (action === "unlock") {
    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);
    const shop = await db.shop.update({
      where: { id: shopId },
      data: {
        billingStatus: BillingStatus.ACTIVE,
        gracePeriodEndsAt: null,
        nextBillingDate: nextBilling,
      },
    });
    return Response.json({ shop });
  }

  if (action === "extend_trial") {
    const { days } = body;
    const d = parseInt(days ?? "14");
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + d);
    const shop = await db.shop.update({
      where: { id: shopId },
      data: { trialEndsAt, billingStatus: BillingStatus.TRIAL },
    });
    return Response.json({ shop });
  }

  if (action === "set_grace") {
    const graceEndsAt = new Date();
    graceEndsAt.setDate(graceEndsAt.getDate() + GRACE_DAYS);
    const shop = await db.shop.update({
      where: { id: shopId },
      data: { billingStatus: BillingStatus.GRACE, gracePeriodEndsAt: graceEndsAt },
    });
    return Response.json({ shop });
  }

  return apiError("Unknown action");
}
