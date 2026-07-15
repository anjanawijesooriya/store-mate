import { db } from "@/lib/db";
import { verifyCronRequest } from "@/lib/cron-auth";
import { sendSmsAndLog, buildDailySummaryMessage } from "@/lib/sms";
import { sendDailySummaryEmail } from "@/lib/mailer";
import { SmsType } from "@/lib/generated/prisma/enums";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    console.warn("[cron/daily-summary] Unauthorized request — check CRON_SECRET in Vercel env vars");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron/daily-summary] Starting daily summary run");

  // "Today" in Sri Lanka time (UTC+5:30)
  const now = new Date();
  const slOffsetMs = 5.5 * 60 * 60 * 1000;
  const slNow = new Date(now.getTime() + slOffsetMs);
  const todayStart = new Date(
    Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), slNow.getUTCDate()) - slOffsetMs
  );
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  console.log(`[cron/daily-summary] Date window: ${todayStart.toISOString()} → ${todayEnd.toISOString()}`);

  const shops = await db.shop.findMany({
    where: { OR: [{ smsDailySummary: true }, { emailDailySummary: true }] },
    select: {
      id: true, name: true, phone: true,
      smsAddonEnabled: true, smsDailySummary: true, emailDailySummary: true,
      sales: {
        where: {
          createdAt: { gte: todayStart, lt: todayEnd },
          // Include credit sales (PENDING_PAYMENT) — they represent real revenue for the day
          status: { in: ["COMPLETED", "PENDING_PAYMENT"] },
        },
        select: { total: true },
      },
      users: { where: { role: "OWNER" }, select: { name: true, email: true }, take: 1 },
    },
  });

  console.log(`[cron/daily-summary] Processing ${shops.length} shops`);

  let smsSent = 0; let emailSent = 0;
  const errors: string[] = [];

  for (const shop of shops) {
    const salesCount = shop.sales.length;
    const revenue    = shop.sales.reduce((sum, s) => sum + Number(s.total), 0);

    console.log(`[cron/daily-summary] ${shop.name}: ${salesCount} sales, LKR ${revenue.toFixed(2)}`);

    // SMS summary
    if (shop.smsAddonEnabled && shop.smsDailySummary) {
      if (!shop.phone) {
        console.warn(`[cron/daily-summary] ${shop.name}: SMS skipped — shop has no phone number`);
        errors.push(`sms:${shop.id}: no phone number`);
      } else {
        const r = await sendSmsAndLog(shop.id, shop.phone, buildDailySummaryMessage(shop.name, salesCount, revenue), SmsType.DAILY_SUMMARY);
        if (r.success) {
          smsSent++;
          console.log(`[cron/daily-summary] ${shop.name}: SMS sent`);
        } else {
          errors.push(`sms:${shop.id}: ${r.error}`);
          console.error(`[cron/daily-summary] ${shop.name}: SMS failed — ${r.error}`);
        }
      }
    } else {
      console.log(`[cron/daily-summary] ${shop.name}: SMS skipped — smsAddonEnabled=${shop.smsAddonEnabled} smsDailySummary=${shop.smsDailySummary}`);
    }

    // Email summary
    const owner = shop.users[0];
    if (shop.emailDailySummary) {
      if (!owner?.email) {
        console.warn(`[cron/daily-summary] ${shop.name}: email skipped — owner has no email address`);
        errors.push(`email:${shop.id}: owner has no email`);
      } else {
        try {
          await sendDailySummaryEmail(owner.email, owner.name, shop.name, salesCount, revenue);
          emailSent++;
          console.log(`[cron/daily-summary] ${shop.name}: email sent to ${owner.email}`);
        } catch (e) {
          errors.push(`email:${shop.id}: ${e}`);
          console.error(`[cron/daily-summary] ${shop.name}: email failed —`, e);
        }
      }
    }
  }

  console.log(`[cron/daily-summary] Done — smsSent=${smsSent} emailSent=${emailSent} errors=${errors.length}`);
  return Response.json({ smsSent, emailSent, errors });
}
