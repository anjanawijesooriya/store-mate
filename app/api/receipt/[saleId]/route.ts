import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;

  try {
    const sale = await db.sale.findUnique({
      where: { id: saleId },
      include: {
        shop: { select: { name: true, phone: true, address: true } },
        items: {
          include: { product: { select: { name: true, itemCode: true, unit: true } } },
        },
        customer: { select: { name: true } },
      },
    });

    if (!sale) {
      return Response.json({ error: "Receipt not found" }, { status: 404 });
    }

    return Response.json({
      id: sale.id,
      shopName: sale.shop.name,
      shopPhone: sale.shop.phone,
      shopAddress: sale.shop.address,
      customerName: sale.customer?.name ?? null,
      paymentMethod: sale.paymentMethod,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      total: Number(sale.total),
      amountPaid: Number(sale.amountPaid),
      status: sale.status,
      createdAt: sale.createdAt,
      items: sale.items.map((i) => ({
        name: i.product.name,
        itemCode: i.product.itemCode ?? null,
        unit: i.product.unit,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
      })),
    });
  } catch {
    return Response.json({ error: "Failed to load receipt" }, { status: 500 });
  }
}
