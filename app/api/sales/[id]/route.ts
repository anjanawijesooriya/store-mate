import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";
import { SaleStatus } from "@/lib/generated/prisma/enums";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const shopId = await getShopId();
    const { id } = await params;
    const { action } = await req.json();

    if (action !== "void" && action !== "refund") {
      return apiError("Invalid action — use 'void' or 'refund'");
    }

    const sale = await db.sale.findUnique({
      where: { id, shopId },
      include: { items: { include: { product: { select: { isService: true } } } } },
    });

    if (!sale) return apiError("Sale not found", 404);
    if (sale.status === SaleStatus.VOIDED || sale.status === SaleStatus.REFUNDED) {
      return apiError(`Sale is already ${sale.status.toLowerCase()}`);
    }

    const newStatus = action === "void" ? "VOIDED" : "REFUNDED";

    await db.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: newStatus },
      });

      for (const item of sale.items) {
        if (item.product?.isService) {
          // Services have no stock — nothing to restore
          continue;
        }
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
            note: `${newStatus} — Sale ${sale.id}`,
          },
        });
      }

      if (sale.customerId) {
        // For credit sales: only the still-owed portion remains on creditBalance
        // (amountPaid was already removed from creditBalance when payments were recorded)
        const creditToRestore =
          sale.paymentMethod === "CREDIT"
            ? Number(sale.total) - Number(sale.amountPaid)
            : 0;

        await tx.customer.update({
          where: { id: sale.customerId },
          data: { totalSpent: { decrement: sale.total } },
        });

        // Use a floor-at-zero raw decrement to avoid driving creditBalance negative
        // under concurrent requests (read-then-decrement race under READ COMMITTED).
        if (creditToRestore > 0) {
          await tx.$executeRaw`
            UPDATE "Customer"
            SET "creditBalance" = GREATEST(0::numeric, "creditBalance" - ${creditToRestore}::numeric)
            WHERE id = ${sale.customerId}
          `;
        }
      }
    });

    return Response.json({ success: true, status: newStatus });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    console.error(err);
    return apiError("Failed to update sale", 500);
  }
}
