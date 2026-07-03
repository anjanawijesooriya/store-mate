import { db } from "@/lib/db";
import { verifyCronRequest } from "@/lib/cron-auth";
import { sendSmsAndLog, buildDailySummaryMessage } from "@/lib/sms";
import { sendDailySummaryEmail } from "@/lib/mailer";
import { SmsType } from "@/lib/generated/prisma/enums";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // "Today" in Sri Lanka time (UTC+5:30)
  const now = new Date();
  const slOffsetMs = 5.5 * 60 * 60 * 1000;
  const slNow = new Date(now.getTime() + slOffsetMs);
  const todayStart = new Date(
    Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), slNow.getUTCDate()) - slOffsetMs
  );
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // (Monthly SMS usage reset removed — SMS is now credit-based)

  const shops = await db.shop.findMany({
    where: { OR: [{ smsDailySummary: true }, { emailDailySummary: true }] },
    select: {
      id: true, name: true, phone: true,
      smsDailySummary: true, emailDailySummary: true,
      sales: {
        where: { createdAt: { gte: todayStart, lt: todayEnd }, status: "COMPLETED" },
        select: { total: true },
      },
      users: { where: { role: "OWNER" }, select: { name: true, email: true }, take: 1 },
    },
  });

  let smsSent = 0; let emailSent = 0;
  const errors: string[] = [];

  for (const shop of shops) {
    const salesCount = shop.sales.length;
    const revenue    = shop.sales.reduce((sum, s) => sum + Number(s.total), 0);

    if (shop.smsDailySummary) {
      const r = await sendSmsAndLog(shop.id, shop.phone, buildDailySummaryMessage(shop.name, salesCount, revenue), SmsType.DAILY_SUMMARY);
      if (r.success) smsSent++; else errors.push(`sms:${shop.id}: ${r.error}`);
    }

    const owner = shop.users[0];
    if (shop.emailDailySummary && owner?.email) {
      try {
        await sendDailySummaryEmail(owner.email, owner.name, shop.name, salesCount, revenue);
        emailSent++;
      } catch (e) {
        errors.push(`email:${shop.id}: ${e}`);
      }
    }
  }

  return Response.json({ smsSent, emailSent, errors });
}
