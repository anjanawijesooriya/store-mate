import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const shopId = await getShopId();
    const { id: productId, variantId } = await params;

    const product = await db.product.findUnique({ where: { id: productId, shopId }, select: { id: true } });
    if (!product) return apiError("Product not found", 404);

    const body = await req.json();
    const { size, color, sku, stockQty, lowStockAt, sellPrice } = body;

    const data: Record<string, unknown> = {};
    if (size !== undefined)       data.size       = size.trim();
    if (color !== undefined)      data.color      = color?.trim() || null;
    if (sku !== undefined)        data.sku        = sku?.trim() || null;
    if (stockQty !== undefined)   data.stockQty   = parseFloat(stockQty);
    if (lowStockAt !== undefined) data.lowStockAt = parseFloat(lowStockAt);
    if (sellPrice !== undefined)  data.sellPrice  = sellPrice ? parseFloat(sellPrice) : null;

    const variant = await db.productVariant.update({
      where: { id: variantId, productId },
      data,
    });

    return Response.json({ variant });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to update variant", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const shopId = await getShopId();
    const { id: productId, variantId } = await params;

    const product = await db.product.findUnique({ where: { id: productId, shopId }, select: { id: true } });
    if (!product) return apiError("Product not found", 404);

    await db.productVariant.update({
      where: { id: variantId, productId },
      data: { isActive: false },
    });

    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to delete variant", 500);
  }
}
