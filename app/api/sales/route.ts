import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, getSession, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";
import { PaymentMethod, SaleStatus } from "@/lib/generated/prisma/enums";

export async function GET(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "20");

    const where = {
      shopId,
      ...(from || to ? {
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      } : {}),
    };

    const [sales, total] = await Promise.all([
      db.sale.findMany({
        where,
        include: {
          items: { include: { product: { select: { name: true, unit: true } } } },
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        // originalSaleId and items.returned are included automatically via the model
      }),
      db.sale.count({ where }),
    ]);

    return Response.json({ sales, total, page, limit });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to fetch sales", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const shopId = session.user.shopId;
    const userId = session.user.id;

    const body = await req.json();
    const { items, customerId, discount, paymentMethod, amountPaid } = body;

    const shopSettings = await db.shop.findUnique({
      where: { id: shopId },
      select: { cardSurchargeEnabled: true, cardSurchargeRate: true },
    });

    if (!items || items.length === 0) {
      return apiError("Cart is empty");
    }

    if (!Object.values(PaymentMethod).includes(paymentMethod)) {
      return apiError("Invalid payment method");
    }

    // Verify all products belong to this shop
    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds }, shopId, isActive: true },
    });

    if (products.length !== productIds.length) {
      return apiError("One or more products not found");
    }

    type ProductRecord = typeof products[0];
    const productMap = new Map<string, ProductRecord>(products.map((p: ProductRecord) => [p.id, p]));

    type SaleItemInput = { productId: string; quantity: number; unitPrice?: number };
    const saleItems = (items as SaleItemInput[]).map((item) => {
      const product = productMap.get(item.productId)!;
      const qty = parseFloat(String(item.quantity));
      const unitPrice = parseFloat(String(item.unitPrice ?? product.sellPrice));
      return {
        productId: item.productId,
        quantity: qty,
        unitPrice,
        lineTotal: qty * unitPrice,
        stockQty: Number(product.stockQty),
        productName: product.name,
        isService: product.isService,
      };
    });

    const subtotal = saleItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const discountAmt = parseFloat(String(discount ?? 0));
    const total = Math.max(0, subtotal - discountAmt);

    // Card surcharge — business absorbs, recorded internally for P&L
    const cardFeeRate =
      paymentMethod === "CARD" && shopSettings?.cardSurchargeEnabled
        ? Number(shopSettings.cardSurchargeRate ?? 0)
        : 0;
    const cardFee = cardFeeRate > 0 ? parseFloat((total * cardFeeRate).toFixed(2)) : 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sale = await db.$transaction(async (tx: any) => {
      // Re-read stock inside the transaction to prevent race conditions when
      // multiple cashiers sell the same product simultaneously
      for (const item of saleItems) {
        if (item.isService) continue;
        const fresh = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stockQty: true },
        });
        const currentQty = Number(fresh?.stockQty ?? 0);
        if (currentQty < item.quantity) {
          throw new Error(`Insufficient stock for ${item.productName} (have ${currentQty}, need ${item.quantity})`);
        }
      }

      const s = await tx.sale.create({
        data: {
          shopId,
          userId,
          customerId: customerId || null,
          subtotal,
          discount: discountAmt,
          total,
          paymentMethod: paymentMethod as PaymentMethod,
          amountPaid: parseFloat(String(amountPaid ?? total)),
          cardFee,
          cardFeeRate,
          status: paymentMethod === "CREDIT" ? SaleStatus.PENDING_PAYMENT : SaleStatus.COMPLETED,
          items: {
            create: saleItems.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              lineTotal: i.lineTotal,
            })),
          },
        },
        include: {
          items: { include: { product: { select: { name: true, unit: true } } } },
          customer: { select: { id: true, name: true, phone: true } },
        },
      });

      // Decrement stock and create movements — skip for services (no inventory)
      for (const item of saleItems) {
        if (item.isService) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "SALE",
            quantity: -item.quantity,
            note: `Sale ${s.id}`,
          },
        });
      }

      // Update customer totals and credit balance if credit sale
      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalSpent: { increment: total },
            ...(paymentMethod === "CREDIT" && { creditBalance: { increment: total } }),
          },
        });
      }

      return s;
    });

    return Response.json({ sale }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/sales]", message);
    return apiError(process.env.NODE_ENV === "development" ? message : "Failed to process sale", 500);
  }
}

