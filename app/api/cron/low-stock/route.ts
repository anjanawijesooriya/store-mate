import { db } from "@/lib/db";
import { verifyCronRequest } from "@/lib/cron-auth";
import { sendSmsAndLog, buildLowStockMessage } from "@/lib/sms";
import { SmsType } from "@/lib/generated/prisma/enums";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shops = await db.shop.findMany({
    where: { smsLowStock: true },
    select: {
      id: true,
      name: true,
      phone: true,
      products: {
        where: { isActive: true },
        select: { name: true, stockQty: true, lowStockAt: true },
      },
    },
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const shop of shops) {
    const lowItems = shop.products
      .filter((p) => Number(p.stockQty) <= Number(p.lowStockAt))
      .map((p) => ({ name: p.name, qty: Number(p.stockQty) }));

    if (lowItems.length === 0) { skipped++; continue; }

    const message = buildLowStockMessage(shop.name, lowItems);
    const result = await sendSmsAndLog(shop.id, shop.phone, message, SmsType.LOW_STOCK);

    if (result.success) sent++; else errors.push(`${shop.id}: ${result.error}`);
  }

  return Response.json({ sent, skipped, errors });
}
