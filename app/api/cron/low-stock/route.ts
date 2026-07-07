import { db } from "@/lib/db";
import { verifyCronRequest } from "@/lib/cron-auth";
import { sendSmsAndLog, buildLowStockMessage } from "@/lib/sms";
import { sendLowStockEmail } from "@/lib/mailer";
import { SmsType } from "@/lib/generated/prisma/enums";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    console.warn("[cron/low-stock] Unauthorized request — check CRON_SECRET in Vercel env vars");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron/low-stock] Starting low-stock alert run");

  const shops = await db.shop.findMany({
    where: { OR: [{ smsLowStock: true }, { emailLowStock: true }] },
    select: {
      id: true, name: true, phone: true,
      smsAddonEnabled: true, smsLowStock: true, emailLowStock: true,
      products: {
        // isService: false — services have no stock, always excluded
        where: { isActive: true, isService: false },
        select: { name: true, stockQty: true, lowStockAt: true },
      },
      users: { where: { role: "OWNER" }, select: { name: true, email: true }, take: 1 },
    },
  });

  console.log(`[cron/low-stock] Processing ${shops.length} shops`);

  let smsSent = 0; let emailSent = 0; let skipped = 0;
  const errors: string[] = [];

  for (const shop of shops) {
    const lowItems = shop.products
      .filter((p) => Number(p.stockQty) <= Number(p.lowStockAt))
      .map((p) => ({ name: p.name, qty: Number(p.stockQty) }));

    if (lowItems.length === 0) {
      console.log(`[cron/low-stock] ${shop.name}: no low-stock items, skipping`);
      skipped++;
      continue;
    }

    console.log(`[cron/low-stock] ${shop.name}: ${lowItems.length} low-stock items`);

    // SMS alert
    if (shop.smsAddonEnabled && shop.smsLowStock) {
      if (!shop.phone) {
        console.warn(`[cron/low-stock] ${shop.name}: SMS skipped — shop has no phone number`);
        errors.push(`sms:${shop.id}: no phone number`);
      } else {
        const r = await sendSmsAndLog(shop.id, shop.phone, buildLowStockMessage(shop.name, lowItems), SmsType.LOW_STOCK);
        if (r.success) {
          smsSent++;
          console.log(`[cron/low-stock] ${shop.name}: SMS sent`);
        } else {
          errors.push(`sms:${shop.id}: ${r.error}`);
          console.error(`[cron/low-stock] ${shop.name}: SMS failed — ${r.error}`);
        }
      }
    } else {
      console.log(`[cron/low-stock] ${shop.name}: SMS skipped — smsAddonEnabled=${shop.smsAddonEnabled} smsLowStock=${shop.smsLowStock}`);
    }

    // Email alert
    const owner = shop.users[0];
    if (shop.emailLowStock) {
      if (!owner?.email) {
        console.warn(`[cron/low-stock] ${shop.name}: email skipped — owner has no email address`);
        errors.push(`email:${shop.id}: owner has no email`);
      } else {
        try {
          await sendLowStockEmail(owner.email, owner.name, shop.name, lowItems);
          emailSent++;
          console.log(`[cron/low-stock] ${shop.name}: email sent to ${owner.email}`);
        } catch (e) {
          errors.push(`email:${shop.id}: ${e}`);
          console.error(`[cron/low-stock] ${shop.name}: email failed —`, e);
        }
      }
    }
  }

  console.log(`[cron/low-stock] Done — smsSent=${smsSent} emailSent=${emailSent} skipped=${skipped} errors=${errors.length}`);
  return Response.json({ smsSent, emailSent, skipped, errors });
}
