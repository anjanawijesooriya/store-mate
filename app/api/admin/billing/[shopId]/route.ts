import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";
import { BillingStatus, PlanTier } from "@/lib/generated/prisma/enums";
import { sendMaintenanceEmail } from "@/lib/mailer";

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

    // For lifetime payments there is no next billing date
    let nextBillingDate: Date | null = null;
    if (billingMonth !== "LIFETIME") {
      nextBillingDate = new Date(billingMonth);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      nextBillingDate.setDate(1);
    }

    const [shop] = await db.$transaction([
      db.shop.update({
        where: { id: shopId },
        data: {
          billingStatus: BillingStatus.ACTIVE,
          planTier: planTier as PlanTier,
          nextBillingDate,
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
    // Give a fresh grace window — owner must pay before it expires.
    // Only mark_paid transitions to ACTIVE.
    const graceEndsAt = new Date();
    graceEndsAt.setDate(graceEndsAt.getDate() + GRACE_DAYS);
    const shop = await db.shop.update({
      where: { id: shopId },
      data: {
        billingStatus: BillingStatus.GRACE,
        gracePeriodEndsAt: graceEndsAt,
        nextBillingDate: null,
      },
    });
    return Response.json({ shop });
  }

  if (action === "extend_trial") {
    const { days } = body;
    const d = parseInt(days ?? "14");
    const current = await db.shop.findUnique({ where: { id: shopId }, select: { trialEndsAt: true, billingStatus: true } });
    const now = new Date();
    // Extend from existing trial end if still in future; otherwise extend from today
    const base = current?.billingStatus === BillingStatus.TRIAL && current.trialEndsAt && current.trialEndsAt > now
      ? new Date(current.trialEndsAt)
      : now;
    base.setDate(base.getDate() + d);
    const shop = await db.shop.update({
      where: { id: shopId },
      data: { trialEndsAt: base, billingStatus: BillingStatus.TRIAL },
    });
    return Response.json({ shop });
  }

  if (action === "set_maintenance") {
    const { enabled, message } = body;
    const [shop, owner] = await Promise.all([
      db.shop.update({
        where: { id: shopId },
        data: {
          maintenanceBanner: !!enabled,
          maintenanceBannerMessage: enabled ? (message?.trim() || null) : null,
        },
      }),
      db.user.findFirst({
        where: { shopId, role: "OWNER" },
        select: { email: true, name: true },
      }),
    ]);

    if (enabled && owner?.email) {
      sendMaintenanceEmail(owner.email, owner.name ?? shop.ownerName, shop.name, message).catch(() => {});
    }

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
