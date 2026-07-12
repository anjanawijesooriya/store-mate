import { db } from "@/lib/db";
import { verifyCronRequest } from "@/lib/cron-auth";
import { BillingStatus } from "@/lib/generated/prisma/enums";

export const runtime = "nodejs";

const GRACE_DAYS = 5;
// Sri Lanka is UTC+5:30
const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Returns midnight SL time (as UTC) for GRACE_DAYS from now.
// e.g. if today is July 8 SL and GRACE_DAYS=5, returns midnight SL July 13
// which is 18:30 UTC July 12 — exactly when the cron fires next on July 13 SL.
function graceEndMidnightSL(now: Date): Date {
  const slNow = new Date(now.getTime() + SL_OFFSET_MS);
  const midnightSLToday = new Date(
    Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), slNow.getUTCDate()) - SL_OFFSET_MS
  );
  return new Date(midnightSLToday.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
}

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let transitioned = 0;

  // TRIAL → GRACE: trial has ended, no payment on record
  const expiredTrials = await db.shop.findMany({
    where: {
      isLifetime: false,
      billingStatus: BillingStatus.TRIAL,
      trialEndsAt: { lte: now },
    },
    select: { id: true },
  });

  if (expiredTrials.length > 0) {
    const graceEndsAt = graceEndMidnightSL(now);
    await db.shop.updateMany({
      where: { id: { in: expiredTrials.map((s) => s.id) }, billingStatus: BillingStatus.TRIAL },
      data: { billingStatus: BillingStatus.GRACE, gracePeriodEndsAt: graceEndsAt },
    });
    transitioned += expiredTrials.length;
  }

  // ACTIVE → GRACE: next billing date passed (lifetime shops excluded)
  const overdueActive = await db.shop.findMany({
    where: {
      isLifetime: false,
      billingStatus: BillingStatus.ACTIVE,
      nextBillingDate: { lte: now },
    },
    select: { id: true },
  });

  if (overdueActive.length > 0) {
    const graceEndsAt = graceEndMidnightSL(now);
    await db.shop.updateMany({
      where: { id: { in: overdueActive.map((s) => s.id) }, billingStatus: BillingStatus.ACTIVE },
      data: { billingStatus: BillingStatus.GRACE, gracePeriodEndsAt: graceEndsAt },
    });
    transitioned += overdueActive.length;
  }

  // GRACE → LOCKED: grace period expired (lte so shops locked at midnight SL on grace-end day)
  const graceExpired = await db.shop.findMany({
    where: {
      isLifetime: false,
      billingStatus: BillingStatus.GRACE,
      gracePeriodEndsAt: { lte: now },
    },
    select: { id: true },
  });

  if (graceExpired.length > 0) {
    await db.shop.updateMany({
      where: { id: { in: graceExpired.map((s) => s.id) }, billingStatus: BillingStatus.GRACE },
      data: { billingStatus: BillingStatus.LOCKED },
    });
    transitioned += graceExpired.length;
  }

  return Response.json({ transitioned, checkedAt: now.toISOString() });
}
