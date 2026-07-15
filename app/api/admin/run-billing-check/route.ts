import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";
import { BillingStatus } from "@/lib/generated/prisma/enums";

const GRACE_DAYS = 5;

export async function POST() {
  if (!(await isAdmin())) return apiError("Unauthorized", 401);

  const now = new Date();
  let transitioned = 0;
  const log: string[] = [];

  // TRIAL → GRACE
  const expiredTrials = await db.shop.findMany({
    where: { billingStatus: BillingStatus.TRIAL, trialEndsAt: { lt: now } },
    select: { id: true, name: true },
  });
  if (expiredTrials.length > 0) {
    const graceEndsAt = new Date(now);
    graceEndsAt.setDate(graceEndsAt.getDate() + GRACE_DAYS);
    await db.shop.updateMany({
      where: { id: { in: expiredTrials.map((s) => s.id) } },
      data: { billingStatus: BillingStatus.GRACE, gracePeriodEndsAt: graceEndsAt },
    });
    transitioned += expiredTrials.length;
    log.push(`${expiredTrials.length} trial(s) → Grace: ${expiredTrials.map((s) => s.name).join(", ")}`);
  }

  // ACTIVE → GRACE
  const overdueActive = await db.shop.findMany({
    where: { billingStatus: BillingStatus.ACTIVE, nextBillingDate: { lt: now } },
    select: { id: true, name: true },
  });
  if (overdueActive.length > 0) {
    const graceEndsAt = new Date(now);
    graceEndsAt.setDate(graceEndsAt.getDate() + GRACE_DAYS);
    await db.shop.updateMany({
      where: { id: { in: overdueActive.map((s) => s.id) } },
      data: { billingStatus: BillingStatus.GRACE, gracePeriodEndsAt: graceEndsAt },
    });
    transitioned += overdueActive.length;
    log.push(`${overdueActive.length} active → Grace: ${overdueActive.map((s) => s.name).join(", ")}`);
  }

  // GRACE → LOCKED
  const graceExpired = await db.shop.findMany({
    where: { billingStatus: BillingStatus.GRACE, gracePeriodEndsAt: { lt: now } },
    select: { id: true, name: true },
  });
  if (graceExpired.length > 0) {
    await db.shop.updateMany({
      where: { id: { in: graceExpired.map((s) => s.id) } },
      data: { billingStatus: BillingStatus.LOCKED },
    });
    transitioned += graceExpired.length;
    log.push(`${graceExpired.length} grace → Locked: ${graceExpired.map((s) => s.name).join(", ")}`);
  }

  return Response.json({ transitioned, log, checkedAt: now.toISOString() });
}
