import { db } from "@/lib/db";
import { verifyCronRequest } from "@/lib/cron-auth";
import { BillingStatus } from "@/lib/generated/prisma/enums";

export const runtime = "nodejs";

const GRACE_DAYS = 5;

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let transitioned = 0;

  // TRIAL → GRACE: trial has ended, no payment on record
  const expiredTrials = await db.shop.findMany({
    where: {
      billingStatus: BillingStatus.TRIAL,
      trialEndsAt: { lt: now },
    },
    select: { id: true },
  });

  if (expiredTrials.length > 0) {
    const graceEndsAt = new Date(now);
    graceEndsAt.setDate(graceEndsAt.getDate() + GRACE_DAYS);
    await db.shop.updateMany({
      where: { id: { in: expiredTrials.map((s) => s.id) } },
      data: { billingStatus: BillingStatus.GRACE, gracePeriodEndsAt: graceEndsAt },
    });
    transitioned += expiredTrials.length;
  }

  // ACTIVE → GRACE: next billing date passed
  const overdueActive = await db.shop.findMany({
    where: {
      billingStatus: BillingStatus.ACTIVE,
      nextBillingDate: { lt: now },
    },
    select: { id: true },
  });

  if (overdueActive.length > 0) {
    const graceEndsAt = new Date(now);
    graceEndsAt.setDate(graceEndsAt.getDate() + GRACE_DAYS);
    await db.shop.updateMany({
      where: { id: { in: overdueActive.map((s) => s.id) } },
      data: { billingStatus: BillingStatus.GRACE, gracePeriodEndsAt: graceEndsAt },
    });
    transitioned += overdueActive.length;
  }

  // GRACE → LOCKED: grace period expired
  const graceExpired = await db.shop.findMany({
    where: {
      billingStatus: BillingStatus.GRACE,
      gracePeriodEndsAt: { lt: now },
    },
    select: { id: true },
  });

  if (graceExpired.length > 0) {
    await db.shop.updateMany({
      where: { id: { in: graceExpired.map((s) => s.id) } },
      data: { billingStatus: BillingStatus.LOCKED },
    });
    transitioned += graceExpired.length;
  }

  return Response.json({ transitioned, checkedAt: now.toISOString() });
}
