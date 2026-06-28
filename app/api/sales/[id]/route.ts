import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

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
      include: { items: true },
    });

    if (!sale) return apiError("Sale not found", 404);
    if (sale.status !== "COMPLETED") {
      return apiError(`Sale is already ${sale.status.toLowerCase()}`);
    }

    const newStatus = action === "void" ? "VOIDED" : "REFUNDED";

    await db.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: newStatus },
      });

      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { increment: item.quantity } },
        });
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
        await tx.customer.update({
          where: { id: sale.customerId },
          data: {
            totalSpent: { decrement: sale.total },
            ...(sale.paymentMethod === "CREDIT" && {
              creditBalance: { decrement: sale.total },
            }),
          },
        });
      }
    });

    return Response.json({ success: true, status: newStatus });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    console.error(err);
    return apiError("Failed to update sale", 500);
  }
}
