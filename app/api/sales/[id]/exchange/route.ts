import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";
import { SaleStatus, PaymentMethod } from "@/lib/generated/prisma/enums";

interface NewItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const shopId = session.user.shopId;
    const userId = session.user.id;
    const { id: originalSaleId } = await params;

    const body = await req.json();
    const {
      returnItemIds,
      newItems,
      paymentMethod,
      amountPaid,
    }: {
      returnItemIds: string[];
      newItems: NewItemInput[];
      paymentMethod: string;
      amountPaid: number;
    } = body;

    if (!returnItemIds?.length && !newItems?.length) {
      return apiError("Nothing to exchange — select items to return or add replacement items");
    }

    if (!Object.values(PaymentMethod).includes(paymentMethod as PaymentMethod)) {
      return apiError("Invalid payment method");
    }

    // Load original sale with all its items
    const originalSale = await db.sale.findUnique({
      where: { id: originalSaleId, shopId },
      include: { items: { include: { product: true } } },
    });

    if (!originalSale) return apiError("Sale not found", 404);
    if (
      originalSale.status === SaleStatus.VOIDED ||
      originalSale.status === SaleStatus.REFUNDED ||
      originalSale.status === SaleStatus.EXCHANGED
    ) {
      return apiError(`Cannot exchange a ${originalSale.status.toLowerCase()} sale`);
    }

    // Validate return items belong to this sale and aren't already returned
    const originalItemMap = new Map(originalSale.items.map((i) => [i.id, i]));
    const returnItems = returnItemIds.map((rid) => {
      const item = originalItemMap.get(rid);
      if (!item) throw new Error(`Item ${rid} not found in this sale`);
      if (item.returned) throw new Error(`Item ${item.product.name} was already returned`);
      return item;
    });

    // Validate + load new products
    const newProductIds = newItems.map((i) => i.productId);
    const newProducts = newProductIds.length
      ? await db.product.findMany({ where: { id: { in: newProductIds }, shopId, isActive: true } })
      : [];

    if (newProducts.length !== newProductIds.length) {
      return apiError("One or more replacement products not found");
    }

    const newProductMap = new Map(newProducts.map((p) => [p.id, p]));

    // Stock check for new items
    for (const item of newItems) {
      const product = newProductMap.get(item.productId)!;
      if (Number(product.stockQty) < item.quantity) {
        return apiError(`Insufficient stock for ${product.name} (have ${product.stockQty}, need ${item.quantity})`);
      }
    }

    // Value calculations
    const returnedValue = returnItems.reduce((s, i) => s + Number(i.lineTotal), 0);
    const newItemsSubtotal = newItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    // Customer credit from returns is applied as discount
    const discount = Math.min(returnedValue, newItemsSubtotal);
    const netTotal = Math.max(0, newItemsSubtotal - returnedValue);
    // If shop owes customer (returned more than new items), cashback amount
    const cashback = Math.max(0, returnedValue - newItemsSubtotal);

    const exchangeSale = await db.$transaction(async (tx) => {
      // 1. Mark returned items
      if (returnItemIds.length) {
        await tx.saleItem.updateMany({
          where: { id: { in: returnItemIds }, saleId: originalSaleId },
          data: { returned: true },
        });
      }

      // 2. Check if ALL items in original sale are now returned → mark EXCHANGED
      const allItems = originalSale.items.length;
      const nowReturnedCount = returnItemIds.length +
        originalSale.items.filter((i) => i.returned).length;
      const fullyExchanged = nowReturnedCount >= allItems;

      if (fullyExchanged) {
        await tx.sale.update({
          where: { id: originalSaleId },
          data: { status: SaleStatus.EXCHANGED },
        });
      }

      // 3. Restore stock for returned items
      for (const item of returnItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "RETURN",
            quantity: Number(item.quantity),
            note: `Exchange — returned from Sale ${originalSaleId}`,
          },
        });
      }

      // 4. Deduct stock for new items
      for (const item of newItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "SALE",
            quantity: -item.quantity,
            note: `Exchange — new item for Sale ${originalSaleId}`,
          },
        });
      }

      // 5. Create the exchange sale record
      const isCredit = paymentMethod === PaymentMethod.CREDIT;
      const newSale = await tx.sale.create({
        data: {
          shopId,
          userId,
          customerId: originalSale.customerId,
          originalSaleId,
          subtotal: newItemsSubtotal,
          discount,
          total: netTotal,
          paymentMethod: paymentMethod as PaymentMethod,
          amountPaid: isCredit ? 0 : Number(amountPaid),
          status: isCredit && netTotal > 0 ? SaleStatus.PENDING_PAYMENT : SaleStatus.COMPLETED,
          items: {
            create: newItems.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              lineTotal: i.quantity * i.unitPrice,
            })),
          },
        },
        include: {
          items: { include: { product: { select: { name: true, unit: true } } } },
          customer: { select: { id: true, name: true, phone: true } },
        },
      });

      // 6. Adjust customer credit balance if relevant
      if (originalSale.customerId) {
        // totalSpent: add new items cost, subtract returned items cost
        const spentDelta = newItemsSubtotal - returnedValue;

        // creditBalance adjustments:
        // - If original was credit and we're returning items: reduce the debt
        // - If new items are on credit: add to debt
        let creditDelta = 0;
        if (originalSale.paymentMethod === PaymentMethod.CREDIT) {
          // Returned items reduce the original credit debt
          creditDelta -= returnedValue;
        }
        if (isCredit && netTotal > 0) {
          // New items on credit add to debt
          creditDelta += netTotal;
        }

        await tx.customer.update({
          where: { id: originalSale.customerId },
          data: {
            ...(spentDelta !== 0 && {
              totalSpent: spentDelta > 0
                ? { increment: spentDelta }
                : { decrement: -spentDelta },
            }),
            ...(creditDelta > 0 && { creditBalance: { increment: creditDelta } }),
            ...(creditDelta < 0 && { creditBalance: { decrement: Math.min(-creditDelta, Number((await tx.customer.findUnique({ where: { id: originalSale.customerId! } }))?.creditBalance ?? 0)) } }),
          },
        });
      }

      return { sale: newSale, cashback, fullyExchanged };
    });

    return Response.json(exchangeSale, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/sales/[id]/exchange]", message);
    return apiError(
      process.env.NODE_ENV === "development" ? message : "Failed to process exchange",
      500
    );
  }
}
