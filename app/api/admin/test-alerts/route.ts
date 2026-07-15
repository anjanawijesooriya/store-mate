import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";
import { sendSmsAndLog, buildLowStockMessage, buildDailySummaryMessage } from "@/lib/sms";
import { sendLowStockEmail, sendDailySummaryEmail } from "@/lib/mailer";
import { SmsType } from "@/lib/generated/prisma/enums";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return apiError("Forbidden", 403);

  const { type, shopId } = await req.json() as { type: "low-stock" | "daily-summary"; shopId: string };
  if (!type || !shopId) return Response.json({ error: "type and shopId required" }, { status: 400 });

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: {
      id: true, name: true, phone: true,
      smsAddonEnabled: true, smsLowStock: true, smsDailySummary: true,
      emailLowStock: true, emailDailySummary: true,
      products: {
        where: { isActive: true, isService: false },
        select: { name: true, stockQty: true, lowStockAt: true },
      },
      users: { where: { role: "OWNER" }, select: { name: true, email: true }, take: 1 },
    },
  });

  if (!shop) return Response.json({ error: "Shop not found" }, { status: 404 });

  const owner = shop.users[0];
  const log: string[] = [];
  let smsSent = false;
  let emailSent = false;
  const errors: string[] = [];

  if (type === "low-stock") {
    const lowItems = shop.products
      .filter((p) => Number(p.stockQty) <= Number(p.lowStockAt))
      .map((p) => ({ name: p.name, qty: Number(p.stockQty) }));

    log.push(`Found ${lowItems.length} low-stock products`);

    if (lowItems.length === 0) {
      log.push("No low-stock products — nothing to send");
    } else {
      if (shop.smsAddonEnabled && shop.smsLowStock) {
        if (!shop.phone) {
          errors.push("SMS: shop has no phone number");
        } else {
          const r = await sendSmsAndLog(shop.id, shop.phone, buildLowStockMessage(shop.name, lowItems), SmsType.LOW_STOCK);
          if (r.success) { smsSent = true; log.push(`SMS sent to ${shop.phone}`); }
          else { errors.push(`SMS failed: ${r.error}`); }
        }
      } else {
        log.push(`SMS skipped — smsAddonEnabled=${shop.smsAddonEnabled}, smsLowStock=${shop.smsLowStock}`);
      }

      if (shop.emailLowStock) {
        if (!owner?.email) {
          errors.push("Email: owner has no email address");
        } else {
          try {
            await sendLowStockEmail(owner.email, owner.name, shop.name, lowItems);
            emailSent = true;
            log.push(`Email sent to ${owner.email}`);
          } catch (e) {
            errors.push(`Email failed: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      } else {
        log.push(`Email skipped — emailLowStock=${shop.emailLowStock}`);
      }
    }
  }

  if (type === "daily-summary") {
    const slOffsetMs = 5.5 * 60 * 60 * 1000;
    const slNow = new Date(Date.now() + slOffsetMs);
    const todayStart = new Date(
      Date.UTC(slNow.getUTCFullYear(), slNow.getUTCMonth(), slNow.getUTCDate()) - slOffsetMs
    );
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const sales = await db.sale.findMany({
      where: {
        shopId,
        createdAt: { gte: todayStart, lt: todayEnd },
        status: { in: ["COMPLETED", "PENDING_PAYMENT"] },
      },
      select: { total: true },
    });

    const salesCount = sales.length;
    const revenue = sales.reduce((s, x) => s + Number(x.total), 0);
    log.push(`Today: ${salesCount} sales, LKR ${revenue.toFixed(2)}`);

    if (shop.smsAddonEnabled && shop.smsDailySummary) {
      if (!shop.phone) {
        errors.push("SMS: shop has no phone number");
      } else {
        const r = await sendSmsAndLog(shop.id, shop.phone, buildDailySummaryMessage(shop.name, salesCount, revenue), SmsType.DAILY_SUMMARY);
        if (r.success) { smsSent = true; log.push(`SMS sent to ${shop.phone}`); }
        else { errors.push(`SMS failed: ${r.error}`); }
      }
    } else {
      log.push(`SMS skipped — smsAddonEnabled=${shop.smsAddonEnabled}, smsDailySummary=${shop.smsDailySummary}`);
    }

    if (shop.emailDailySummary) {
      if (!owner?.email) {
        errors.push("Email: owner has no email address");
      } else {
        try {
          await sendDailySummaryEmail(owner.email, owner.name, shop.name, salesCount, revenue);
          emailSent = true;
          log.push(`Email sent to ${owner.email}`);
        } catch (e) {
          errors.push(`Email failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } else {
      log.push(`Email skipped — emailDailySummary=${shop.emailDailySummary}`);
    }
  }

  return Response.json({ smsSent, emailSent, log, errors });
}
