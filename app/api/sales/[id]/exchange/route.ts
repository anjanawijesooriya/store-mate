import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";
import { SaleStatus, PaymentMethod } from "@/lib/generated/prisma/enums";

interface NewItemInput {
  productId: string;
  variantId?: string;
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

    // Validate + load new products (deduplicate so a repeated productId doesn't break the length check)
    const newProductIds = [...new Set(newItems.map((i) => i.productId))];
    const newProducts = newProductIds.length
      ? await db.product.findMany({ where: { id: { in: newProductIds }, shopId, isActive: true } })
      : [];

    if (newProducts.length !== newProductIds.length) {
      return apiError("One or more replacement products not found");
    }

    const newProductMap = new Map(newProducts.map((p) => [p.id, p]));

    // Pre-flight: verify products exist (stock is re-checked inside the transaction to prevent races)
    for (const item of newItems) {
      if (!newProductMap.has(item.productId)) {
        return apiError(`Product not found: ${item.productId}`);
      }
    }

    // Validate that any supplied variantIds belong to their stated productId and to this shop,
    // preventing a cross-shop stock manipulation via a guessed variant UUID.
    const variantItemInputs = newItems.filter((i) => i.variantId);
    if (variantItemInputs.length) {
      const variants = await db.productVariant.findMany({
        where: { id: { in: variantItemInputs.map((i) => i.variantId!) } },
        select: { id: true, productId: true, product: { select: { shopId: true } } },
      });
      const variantMap = new Map(variants.map((v) => [v.id, v]));
      for (const item of variantItemInputs) {
        const v = variantMap.get(item.variantId!);
        if (!v || v.productId !== item.productId || v.product.shopId !== shopId) {
          return apiError("Invalid variant — does not belong to this product or shop");
        }
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
      // Re-query inside the transaction so concurrent exchanges see each other's writes.
      const allItems = originalSale.items.length;
      const returnedCount = await tx.saleItem.count({
        where: { saleId: originalSaleId, returned: true },
      });
      const fullyExchanged = returnedCount >= allItems;

      if (fullyExchanged) {
        await tx.sale.update({
          where: { id: originalSaleId },
          data: { status: SaleStatus.EXCHANGED },
        });
      }

      // 3. Restore stock for returned items — use variant table when the original sale was a variant sale
      for (const item of returnItems) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQty: { increment: item.quantity } },
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { increment: item.quantity } },
          });
        }
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "RETURN",
            quantity: Number(item.quantity),
            note: `Exchange — returned from Sale ${originalSaleId}`,
          },
        });
      }

      // 4. Deduct stock for new items — re-check inside tx to prevent races
      for (const item of newItems) {
        const product = newProductMap.get(item.productId)!;
        if (item.variantId) {
          const fresh = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { stockQty: true },
          });
          const currentQty = Number(fresh?.stockQty ?? 0);
          if (currentQty < item.quantity) {
            throw new Error(`Insufficient stock for ${product.name} variant (have ${currentQty}, need ${item.quantity})`);
          }
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQty: { decrement: item.quantity } },
          });
        } else {
          const fresh = await tx.product.findUnique({
            where: { id: item.productId },
            select: { stockQty: true },
          });
          const currentQty = Number(fresh?.stockQty ?? 0);
          if (currentQty < item.quantity) {
            throw new Error(`Insufficient stock for ${product.name} (have ${currentQty}, need ${item.quantity})`);
          }
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { decrement: item.quantity } },
          });
        }
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
              variantId: i.variantId ?? null,
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
        const spentDelta = newItemsSubtotal - returnedValue;

        let creditDelta = 0;
        if (originalSale.paymentMethod === PaymentMethod.CREDIT) {
          creditDelta -= returnedValue;
        }
        if (isCredit && netTotal > 0) {
          creditDelta += netTotal;
        }

        if (spentDelta !== 0 || creditDelta > 0) {
          await tx.customer.update({
            where: { id: originalSale.customerId },
            data: {
              ...(spentDelta !== 0 && {
                totalSpent: spentDelta > 0
                  ? { increment: spentDelta }
                  : { decrement: -spentDelta },
              }),
              ...(creditDelta > 0 && { creditBalance: { increment: creditDelta } }),
            },
          });
        }

        // Atomic floor-at-zero decrement: avoids the read-then-decrement race under READ COMMITTED
        if (creditDelta < 0) {
          await tx.$executeRaw`
            UPDATE "Customer"
            SET "creditBalance" = GREATEST(0::numeric, "creditBalance" - ${-creditDelta}::numeric)
            WHERE id = ${originalSale.customerId}
          `;
        }
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
