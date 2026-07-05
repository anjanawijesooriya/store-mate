import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";
import { sendSmsAndLog, buildReceiptLinkMessage } from "@/lib/sms";
import { SmsType } from "@/lib/generated/prisma/enums";

export async function POST(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const { saleId, phone: walkInPhone } = await req.json();
    if (!saleId) return apiError("saleId is required");

    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: { name: true, smsAddonEnabled: true, smsReceiptEnabled: true },
    });
    if (!shop) return apiError("Shop not found", 404);
    if (!shop.smsAddonEnabled) return apiError("SMS add-on is not activated for this shop", 403);
    if (!shop.smsReceiptEnabled) return apiError("Receipt SMS is disabled for this shop", 403);

    const sale = await db.sale.findUnique({
      where: { id: saleId, shopId },
      include: {
        customer: { select: { phone: true } },
      },
    });
    if (!sale) return apiError("Sale not found", 404);

    const recipientPhone = walkInPhone?.trim() || sale.customer?.phone;
    if (!recipientPhone) return apiError("No phone number — enter a number to send the receipt", 400);

    const message = buildReceiptLinkMessage(shop.name, saleId);

    const result = await sendSmsAndLog(shopId, recipientPhone, message, SmsType.RECEIPT, 1);
    if (!result.success) {
      return apiError(result.error ?? "SMS delivery failed — please try again", 502);
    }

    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to send receipt SMS", 500);
  }
}
