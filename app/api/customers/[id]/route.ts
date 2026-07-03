import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";
import { SaleStatus } from "@/lib/generated/prisma/enums";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const shopId = await getShopId();
    const shop = await db.shop.findUnique({ where: { id: shopId }, select: { planTier: true } });
    if (shop?.planTier === "BASIC") return apiError("Customer management requires Standard plan or higher.", 403);
    const { id } = await params;

    const customer = await db.customer.findUnique({
      where: { id, shopId },
      include: {
        sales: {
          where: { status: SaleStatus.PENDING_PAYMENT },
          orderBy: { createdAt: "asc" },
          include: {
            items: { include: { product: { select: { name: true, unit: true } } } },
          },
        },
      },
    });

    if (!customer) return apiError("Customer not found", 404);
    return Response.json({ customer });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to fetch customer", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const shopId = await getShopId();
    const shop = await db.shop.findUnique({ where: { id: shopId }, select: { planTier: true } });
    if (shop?.planTier === "BASIC") return apiError("Customer management requires Standard plan or higher.", 403);
    const { id } = await params;
    const body = await req.json();
    const { action, amount } = body;

    const customer = await db.customer.findUnique({
      where: { id, shopId },
    });
    if (!customer) return apiError("Customer not found", 404);

    if (action === "update") {
      const { name, phone, email, address } = body;
      if (!name?.trim()) return apiError("Customer name is required");

      const emailClean = email?.trim().toLowerCase() || null;
      if (emailClean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
        return apiError("Invalid email address");
      }

      const updated = await db.customer.update({
        where: { id },
        data: {
          name: name.trim(),
          phone: phone?.trim() || null,
          email: emailClean,
          address: address?.trim() || null,
        },
      });
      return Response.json({ customer: updated });
    }

    if (action === "record_payment") {
      const pay = Number(amount);
      if (!pay || pay <= 0) return apiError("Invalid payment amount");

      // Fetch all outstanding credit sales, oldest first (FIFO)
      const pendingSales = await db.sale.findMany({
        where: { customerId: id, shopId, status: SaleStatus.PENDING_PAYMENT },
        orderBy: { createdAt: "asc" },
      });

      let remaining = pay;
      let totalApplied = 0;
      const settledSaleIds: string[] = [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.$transaction(async (tx: any) => {
        // FIFO: allocate payment across PENDING_PAYMENT sales oldest-first
        for (const sale of pendingSales) {
          if (remaining <= 0) break;

          const saleTotal = Number(sale.total);
          const alreadyPaid = Number(sale.amountPaid);
          const stillOwed = saleTotal - alreadyPaid;

          const applyToSale = Math.min(remaining, stillOwed);
          const newAmountPaid = alreadyPaid + applyToSale;
          const fullySettled = newAmountPaid >= saleTotal;

          await tx.sale.update({
            where: { id: sale.id },
            data: {
              amountPaid: newAmountPaid,
              ...(fullySettled && { status: SaleStatus.COMPLETED }),
            },
          });

          if (fullySettled) settledSaleIds.push(sale.id);
          remaining -= applyToSale;
          totalApplied += applyToSale;
        }

        // If no PENDING_PAYMENT sales were found (e.g. sale was created before
        // PENDING_PAYMENT status was introduced), still decrement the balance.
        // This handles legacy COMPLETED credit sales that still have creditBalance > 0.
        const creditBalance = Number(customer.creditBalance);
        const apply = Math.min(
          pendingSales.length > 0 ? totalApplied : pay,
          creditBalance
        );

        if (apply > 0) {
          await tx.customer.update({
            where: { id },
            data: { creditBalance: { decrement: apply } },
          });
          totalApplied = apply;
        }
      });

      return Response.json({
        applied: totalApplied,
        settledSales: settledSaleIds.length,
      });
    }

    return apiError("Unknown action");
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to update customer", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const shopId = await getShopId();
    const shop = await db.shop.findUnique({ where: { id: shopId }, select: { planTier: true } });
    if (shop?.planTier === "BASIC") return apiError("Customer management requires Standard plan or higher.", 403);
    const { id } = await params;

    const customer = await db.customer.findUnique({ where: { id, shopId } });
    if (!customer) return apiError("Customer not found", 404);

    await db.customer.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to delete customer", 500);
  }
}
