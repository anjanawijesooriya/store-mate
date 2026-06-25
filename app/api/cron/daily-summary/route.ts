import { db } from "@/lib/db";
import { verifyCronRequest } from "@/lib/cron-auth";
import { sendSmsAndLog, buildDailySummaryMessage } from "@/lib/sms";
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

  // Reset monthly usage on the 1st of each month
  if (slNow.getUTCDate() === 1) {
    await db.shop.updateMany({ data: { smsMonthlyUsage: 0 } });
  }

  const shops = await db.shop.findMany({
    where: { smsDailySummary: true },
    select: {
      id: true,
      name: true,
      phone: true,
      sales: {
        where: { createdAt: { gte: todayStart, lt: todayEnd }, status: "COMPLETED" },
        select: { total: true },
      },
    },
  });

  let sent = 0;
  const errors: string[] = [];

  for (const shop of shops) {
    const salesCount = shop.sales.length;
    const revenue = shop.sales.reduce((sum, s) => sum + Number(s.total), 0);
    const message = buildDailySummaryMessage(shop.name, salesCount, revenue);
    const result = await sendSmsAndLog(shop.id, shop.phone, message, SmsType.DAILY_SUMMARY);

    if (result.success) sent++; else errors.push(`${shop.id}: ${result.error}`);
  }

  return Response.json({ sent, errors });
}
