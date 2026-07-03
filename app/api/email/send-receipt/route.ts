import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";
import { sendReceiptEmail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const { saleId, email: overrideEmail } = await req.json();

    if (!saleId) return apiError("saleId is required");

    const [sale, shop] = await Promise.all([
      db.sale.findFirst({
        where: { id: saleId, shopId },
        include: {
          items: {
            include: { product: { select: { name: true, unit: true, warrantyPeriod: true } } },
          },
          customer: { select: { name: true, email: true } },
        },
      }),
      db.shop.findUnique({
        where: { id: shopId },
        select: { name: true, address: true, phone: true, emailReceiptEnabled: true },
      }),
    ]);

    if (!sale) return apiError("Sale not found", 404);
    if (!shop?.emailReceiptEnabled) return apiError("Email receipts are disabled for this shop");

    const to = overrideEmail?.trim() || sale.customer?.email;
    if (!to) return apiError("No email address available");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return apiError("Invalid email address");

    await sendReceiptEmail(to, {
      saleId:        sale.id,
      shopName:      shop.name,
      shopAddress:   shop.address,
      shopPhone:     shop.phone,
      customerName:  sale.customer?.name ?? null,
      items:         sale.items.map((i) => ({
        name:          i.product.name,
        quantity:      Number(i.quantity),
        unit:          i.product.unit,
        unitPrice:     Number(i.unitPrice),
        lineTotal:     Number(i.lineTotal),
        warrantyPeriod: i.product.warrantyPeriod ?? null,
      })),
      subtotal:      Number(sale.subtotal),
      discount:      Number(sale.discount),
      total:         Number(sale.total),
      paymentMethod: sale.paymentMethod,
      amountPaid:    Number(sale.amountPaid),
      createdAt:     sale.createdAt,
    });

    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    console.error("Send receipt email error:", err);
    return apiError("Failed to send receipt email", 500);
  }
}
