import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

// POST /api/grn/[id]/confirm
// Atomically: creates any new products, increments stock, records PURCHASE movements, locks GRN.

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const shopId = await getShopId();
    const { id } = await params;

    const grn = await db.gRN.findFirst({
      where: { id, shopId },
      include: { items: true },
    });

    if (!grn)                   return apiError("GRN not found", 404);
    if (grn.status !== "DRAFT") return apiError("Only DRAFT GRNs can be confirmed", 400);
    if (grn.items.length === 0) return apiError("GRN has no items", 400);

    // Validate new-product items before entering the transaction
    for (const item of grn.items) {
      if (!item.productId) {
        if (!item.newName?.trim())          return apiError("New product item is missing a name", 400);
        if (item.newSellPrice == null)      return apiError(`New product "${item.newName}" is missing a sell price`, 400);
      }
    }

    await db.$transaction(async (tx) => {
      // Atomic status guard — prevents double-confirm race
      const locked = await tx.gRN.updateMany({
        where: { id, shopId, status: "DRAFT" },
        data:  { status: "CONFIRMED", confirmedAt: new Date() },
      });
      if (locked.count === 0) throw new Error("GRN has already been confirmed or cancelled");

      for (const item of grn.items) {
        let productId = item.productId;

        // ── Create new product if this is an inline new-product line ──
        if (!productId) {
          let newProduct: { id: string };
          try {
            newProduct = await tx.product.create({
              data: {
                shopId,
                name:      item.newName!,
                category:  item.newCategory ?? null,
                unit:      item.newUnit     ?? "pcs",
                sellPrice: item.newSellPrice!,
                costPrice: Number(item.unitCost),
                itemCode:  item.newItemCode ?? null,
                stockQty:  0,
              },
              select: { id: true },
            });
          } catch (e: unknown) {
            const pe = e as { code?: string };
            if (pe.code === "P2002") throw new Error(`Item code "${item.newItemCode}" is already in use by another product`);
            throw e;
          }
          productId = newProduct.id;

          // Link the GRNItem to the newly created product
          await tx.gRNItem.update({ where: { id: item.id }, data: { productId } });
        }

        const qty  = Number(item.quantity);
        const cost = Number(item.unitCost);

        // ── Increment product stock ───────────────────────────
        await tx.product.update({
          where: { id: productId },
          data: { stockQty: { increment: qty } },
        });

        // ── Optionally update costPrice ───────────────────────
        if (item.updateCost) {
          await tx.product.update({
            where: { id: productId },
            data: { costPrice: cost },
          });
        }

        // ── Record PURCHASE stock movement ────────────────────
        await tx.stockMovement.create({
          data: {
            productId,
            type:     "PURCHASE",
            quantity: qty,
            note:     `GRN #${grn.id.slice(-6).toUpperCase()}${grn.supplierName ? ` — ${grn.supplierName}` : ""}`,
          },
        });
      }

    }, { timeout: 30_000 });

    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    if (err instanceof Error) return apiError(err.message, 400);
    return apiError("Failed to confirm GRN", 500);
  }
}
