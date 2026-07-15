import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";
import { MovementType } from "@/lib/generated/prisma/enums";

export async function POST(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const body = await req.json();
    const { productId, variantId, type, quantity, note } = body;

    if (!productId || !type) {
      return apiError("productId and type are required");
    }

    const product = await db.product.findFirst({ where: { id: productId, shopId, isActive: true } });
    if (!product) return apiError("Product not found", 404);
    if (product.isService) return apiError("Stock adjustments do not apply to services", 400);

    // When variantId is supplied, verify it belongs to the stated product before any writes
    if (variantId) {
      const variant = await db.productVariant.findFirst({ where: { id: variantId, productId } });
      if (!variant) return apiError("Variant not found for this product", 404);
    }

    // Special action: zero out stock (no quantity needed)
    if (type === "SET_OUT_OF_STOCK") {
      if (variantId) {
        const variant = await db.productVariant.findFirst({ where: { id: variantId, productId }, select: { stockQty: true } });
        const currentQty = Number(variant?.stockQty ?? 0);
        const [movement] = await db.$transaction([
          db.stockMovement.create({
            data: { productId, type: MovementType.ADJUSTMENT, quantity: currentQty, note: note || "Set to out of stock" },
          }),
          db.productVariant.update({ where: { id: variantId }, data: { stockQty: 0 } }),
        ]);
        return Response.json({ movement, newStock: 0 });
      }
      const currentQty = Number(product.stockQty);
      const [movement] = await db.$transaction([
        db.stockMovement.create({
          data: {
            productId,
            type: MovementType.ADJUSTMENT,
            quantity: currentQty,
            note: note || "Set to out of stock",
          },
        }),
        db.product.update({
          where: { id: productId },
          data: { stockQty: 0 },
        }),
      ]);
      return Response.json({ movement, newStock: 0 });
    }

    if (quantity === undefined) {
      return apiError("quantity is required");
    }

    const validTypes = Object.values(MovementType);
    if (!validTypes.includes(type as MovementType)) {
      return apiError("Invalid movement type");
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty < 0) {
      return apiError("Invalid quantity");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { movement, newStock } = await db.$transaction(async (tx: any) => {
      if (type === "ADJUSTMENT") {
        // Physical count correction — set to exact value (last writer wins by design)
        const mv = await tx.stockMovement.create({
          data: { productId, type: type as MovementType, quantity: qty, note: note || null },
        });
        if (variantId) {
          const updated = await tx.productVariant.update({ where: { id: variantId }, data: { stockQty: qty } });
          return { movement: mv, newStock: Number(updated.stockQty) };
        }
        const updated = await tx.product.update({
          where: { id: productId },
          data: { stockQty: qty },
        });
        return { movement: mv, newStock: Number(updated.stockQty) };
      }

      // Re-read inside transaction to avoid lost-update race conditions
      const currentQty = variantId
        ? Number((await tx.productVariant.findUnique({ where: { id: variantId }, select: { stockQty: true } }))?.stockQty ?? 0)
        : Number((await tx.product.findUnique({ where: { id: productId }, select: { stockQty: true } }))?.stockQty ?? 0);

      const isAdditive = type === "RESTOCK" || type === "RETURN";
      const delta = isAdditive ? qty : -qty;
      const computed = currentQty + delta;

      if (computed < 0) throw new Error("Stock cannot go below zero");

      const mv = await tx.stockMovement.create({
        data: { productId, type: type as MovementType, quantity: qty, note: note || null },
      });

      if (variantId) {
        const updated = await tx.productVariant.update({ where: { id: variantId }, data: { stockQty: { increment: delta } } });
        return { movement: mv, newStock: Number(updated.stockQty) };
      }
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stockQty: { increment: delta } },
      });
      return { movement: mv, newStock: Number(updated.stockQty) };
    });

    return Response.json({ movement, newStock });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    console.error(err);
    return apiError("Failed to adjust stock", 500);
  }
}
