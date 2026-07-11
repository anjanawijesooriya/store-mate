import { db } from "@/lib/db";
import { verifyCronRequest } from "@/lib/cron-auth";
import { sendCreditReminderEmail } from "@/lib/mailer";
import { SaleStatus } from "@/lib/generated/prisma/enums";

export const runtime = "nodejs";

const OVERDUE_DAYS = 14;

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    console.warn("[cron/credit-reminders] Unauthorized request");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - OVERDUE_DAYS);

  const shops = await db.shop.findMany({
    where: { creditReminderEnabled: true },
    select: { id: true, name: true },
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const shop of shops) {
    // Find customers with overdue credit: creditBalance > 0 AND
    // at least one PENDING_PAYMENT sale older than 14 days
    const customers = await db.customer.findMany({
      where: {
        shopId: shop.id,
        creditBalance: { gt: 0 },
        sales: {
          some: {
            status: SaleStatus.PENDING_PAYMENT,
            createdAt: { lte: cutoff },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        creditBalance: true,
        sales: {
          where: { status: SaleStatus.PENDING_PAYMENT },
          orderBy: { createdAt: "asc" },
          select: { id: true, createdAt: true, total: true, amountPaid: true },
        },
      },
    });

    for (const customer of customers) {
      if (!customer.email) {
        skipped++;
        console.log(`[cron/credit-reminders] ${shop.name} → ${customer.name}: skipped — no email`);
        continue;
      }

      try {
        await sendCreditReminderEmail(
          customer.email,
          customer.name,
          shop.name,
          Number(customer.creditBalance),
          customer.sales.map((s) => ({
            id: s.id,
            createdAt: s.createdAt,
            total: Number(s.total),
            amountPaid: Number(s.amountPaid),
          })),
        );
        sent++;
        console.log(`[cron/credit-reminders] ${shop.name} → ${customer.name}: sent to ${customer.email}`);
      } catch (e) {
        errors.push(`${shop.id}:${customer.id}: ${e}`);
        console.error(`[cron/credit-reminders] ${shop.name} → ${customer.name}: failed —`, e);
      }
    }
  }

  console.log(`[cron/credit-reminders] Done — sent=${sent} skipped=${skipped} errors=${errors.length}`);
  return Response.json({ sent, skipped, errors });
}
