import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";
import { MovementType } from "@/lib/generated/prisma/enums";

export async function POST(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const body = await req.json();
    const { productId, type, quantity, note } = body;

    if (!productId || !type) {
      return apiError("productId and type are required");
    }

    const product = await db.product.findFirst({ where: { id: productId, shopId, isActive: true } });
    if (!product) return apiError("Product not found", 404);

    // Special action: zero out stock (no quantity needed)
    if (type === "SET_OUT_OF_STOCK") {
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

    let newStock: number;
    if (type === "ADJUSTMENT") {
      // Correction: set stock TO this exact value (physical count result)
      newStock = qty;
    } else {
      const delta = type === "RESTOCK" || type === "RETURN" ? qty : -qty;
      newStock = Number(product.stockQty) + delta;
      if (newStock < 0) {
        return apiError("Stock cannot go below zero");
      }
    }

    const [movement] = await db.$transaction([
      db.stockMovement.create({
        data: {
          productId,
          type: type as MovementType,
          quantity: qty,
          note: note || null,
        },
      }),
      db.product.update({
        where: { id: productId },
        data: { stockQty: newStock },
      }),
    ]);

    return Response.json({ movement, newStock });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    console.error(err);
    return apiError("Failed to adjust stock", 500);
  }
}

