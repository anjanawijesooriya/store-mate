import { db } from "@/lib/db";
import { verifyCronRequest } from "@/lib/cron-auth";
import { sendSmsAndLog, buildLowStockMessage } from "@/lib/sms";
import { sendLowStockEmail } from "@/lib/mailer";
import { SmsType } from "@/lib/generated/prisma/enums";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shops = await db.shop.findMany({
    where: { OR: [{ smsLowStock: true }, { emailLowStock: true }] },
    select: {
      id: true, name: true, phone: true,
      smsAddonEnabled: true, smsLowStock: true, emailLowStock: true,
      products: {
        where: { isActive: true },
        select: { name: true, stockQty: true, lowStockAt: true },
      },
      users: { where: { role: "OWNER" }, select: { name: true, email: true }, take: 1 },
    },
  });

  let smsSent = 0; let emailSent = 0; let skipped = 0;
  const errors: string[] = [];

  for (const shop of shops) {
    const lowItems = shop.products
      .filter((p) => Number(p.stockQty) <= Number(p.lowStockAt))
      .map((p) => ({ name: p.name, qty: Number(p.stockQty) }));

    if (lowItems.length === 0) { skipped++; continue; }

    if (shop.smsAddonEnabled && shop.smsLowStock) {
      const r = await sendSmsAndLog(shop.id, shop.phone, buildLowStockMessage(shop.name, lowItems), SmsType.LOW_STOCK);
      if (r.success) smsSent++; else errors.push(`sms:${shop.id}: ${r.error}`);
    }

    const owner = shop.users[0];
    if (shop.emailLowStock && owner?.email) {
      try {
        await sendLowStockEmail(owner.email, owner.name, shop.name, lowItems);
        emailSent++;
      } catch (e) {
        errors.push(`email:${shop.id}: ${e}`);
      }
    }
  }

  return Response.json({ smsSent, emailSent, skipped, errors });
}
