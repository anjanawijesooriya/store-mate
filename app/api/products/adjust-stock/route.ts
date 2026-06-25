import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";
import { MovementType } from "@/lib/generated/prisma/enums";

export async function POST(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const body = await req.json();
    const { productId, type, quantity, note } = body;

    if (!productId || !type || quantity === undefined) {
      return apiError("productId, type and quantity are required");
    }

    const validTypes = Object.values(MovementType);
    if (!validTypes.includes(type as MovementType)) {
      return apiError("Invalid movement type");
    }

    const product = await db.product.findFirst({ where: { id: productId, shopId, isActive: true } });
    if (!product) return apiError("Product not found", 404);

    const qty = parseFloat(quantity);
    const delta = type === "RESTOCK" || type === "RETURN" ? qty : -qty;

    const newStock = Number(product.stockQty) + delta;
    if (newStock < 0) {
      return apiError("Stock cannot go below zero");
    }

    const [movement] = await db.$transaction([
      db.stockMovement.create({
        data: {
          productId,
          type: type as MovementType,
          quantity: Math.abs(qty),
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
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    console.error(err);
    return apiError("Failed to adjust stock", 500);
  }
}
