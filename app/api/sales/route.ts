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
    const method = searchParams.get("method");
    const status = searchParams.get("status");
    const customer = searchParams.get("customer");

    const where = {
      shopId,
      ...(from || to ? {
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      } : {}),
      ...(method && method !== "ALL" ? { paymentMethod: method as PaymentMethod } : {}),
      ...(status && status !== "ALL" ? { status: status as SaleStatus } : {}),
      ...(customer ? {
        customer: { name: { contains: customer, mode: "insensitive" as const } },
      } : {}),
    };

    const [sales, total] = await Promise.all([
      db.sale.findMany({
        where,
        include: {
          items: { include: { product: { select: { name: true, unit: true } } } },
          customer: { select: { id: true, name: true, phone: true, email: true } },
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

    // Verify all products belong to this shop (deduplicate — multiple variants share a productId)
    const productIds = [...new Set<string>(items.map((i: { productId: string }) => i.productId))];
    const products = await db.product.findMany({
      where: { id: { in: productIds }, shopId, isActive: true },
    });

    if (products.length !== productIds.length) {
      return apiError("One or more products not found");
    }

    // Verify customerId belongs to this shop — prevents cross-tenant customer record pollution
    if (customerId) {
      const customer = await db.customer.findFirst({ where: { id: customerId, shopId } });
      if (!customer) return apiError("Customer not found", 404);
    }

    type ProductRecord = typeof products[0];
    const productMap = new Map<string, ProductRecord>(products.map((p: ProductRecord) => [p.id, p]));

    type SaleItemInput = { productId: string; variantId?: string; variantLabel?: string; quantity: number; unitPrice?: number };
    const saleItems = (items as SaleItemInput[]).map((item) => {
      const product = productMap.get(item.productId)!;
      const qty = parseFloat(String(item.quantity));
      const unitPrice = parseFloat(String(item.unitPrice ?? product.sellPrice));
      if (isNaN(qty) || qty <= 0) throw new Error(`Invalid quantity for ${product.name}`);
      if (isNaN(unitPrice) || unitPrice < 0) throw new Error(`Invalid price for ${product.name}`);
      return {
        productId: item.productId,
        variantId: item.variantId ?? null,
        variantLabel: item.variantLabel ?? null,
        quantity: qty,
        unitPrice,
        lineTotal: qty * unitPrice,
        stockQty: Number(product.stockQty),
        productName: product.name,
        isService: product.isService,
        isWeighted: product.isWeighted,
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

    // Server-authoritative amountPaid. CREDIT records nothing paid yet; a settled
    // sale (CASH/CARD/ONLINE) is marked COMPLETED so it must be fully covered —
    // don't trust a client that understates it. CASH may tender more (change).
    const parsedAmountPaid =
      paymentMethod === "CREDIT" ? 0 : parseFloat(String(amountPaid ?? total));
    if (paymentMethod !== "CREDIT" && (isNaN(parsedAmountPaid) || parsedAmountPaid < total)) {
      return apiError(`Amount paid is less than the sale total`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sale = await db.$transaction(async (tx: any) => {
      // Re-read stock inside the transaction to prevent race conditions when
      // multiple cashiers sell the same product simultaneously.
      // Weighted products skip the hard-block check: the cashier/scale is the
      // authority on quantity sold, so we never refuse the sale — but stock IS
      // decremented below so the inventory level stays accurate.
      for (const item of saleItems) {
        if (item.isService || item.isWeighted) continue;
        if (item.variantId) {
          // Constrain by productId to ensure the variant belongs to the verified product —
          // prevents cross-tenant stock manipulation via a foreign variantId.
          const fresh = await tx.productVariant.findFirst({
            where: { id: item.variantId, productId: item.productId },
            select: { stockQty: true },
          });
          if (!fresh) throw new Error(`Variant not found for ${item.productName}`);
          const currentQty = Number(fresh.stockQty ?? 0);
          if (currentQty < item.quantity) {
            throw new Error(`Insufficient stock for ${item.productName} (have ${currentQty}, need ${item.quantity})`);
          }
        } else {
          const fresh = await tx.product.findUnique({
            where: { id: item.productId },
            select: { stockQty: true },
          });
          const currentQty = Number(fresh?.stockQty ?? 0);
          if (currentQty < item.quantity) {
            throw new Error(`Insufficient stock for ${item.productName} (have ${currentQty}, need ${item.quantity})`);
          }
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
          amountPaid: parsedAmountPaid,
          cardFee,
          cardFeeRate,
          status: paymentMethod === "CREDIT" ? SaleStatus.PENDING_PAYMENT : SaleStatus.COMPLETED,
          items: {
            create: saleItems.map((i) => ({
              productId: i.productId,
              variantId: i.variantId ?? null,
              variantLabel: i.variantLabel,
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

      // Decrement stock and batch-create movements — skip for services
      const movementData: { productId: string; type: "SALE"; quantity: number; note: string }[] = [];
      for (const item of saleItems) {
        if (item.isService) continue;
        if (item.variantId) {
          // Atomic guarded decrement: folding the stock check into the WHERE
          // clause makes check-and-decrement a single statement, so concurrent
          // sales on multiple devices cannot both pass and oversell to negative.
          const upd = await tx.productVariant.updateMany({
            where: { id: item.variantId, stockQty: { gte: item.quantity } },
            data: { stockQty: { decrement: item.quantity } },
          });
          if (upd.count === 0) {
            throw new Error(`Insufficient stock for ${item.productName}`);
          }
        } else if (item.isWeighted) {
          // Weighted goods are sold by measured scale weight — allow the sale
          // through unguarded even if recorded stock is short (may go negative).
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { decrement: item.quantity } },
          });
        } else {
          const upd = await tx.product.updateMany({
            where: { id: item.productId, stockQty: { gte: item.quantity } },
            data: { stockQty: { decrement: item.quantity } },
          });
          if (upd.count === 0) {
            throw new Error(`Insufficient stock for ${item.productName}`);
          }
        }
        movementData.push({ productId: item.productId, type: "SALE", quantity: -item.quantity, note: `Sale ${s.id}` });
      }
      if (movementData.length > 0) {
        await tx.stockMovement.createMany({ data: movementData });
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

