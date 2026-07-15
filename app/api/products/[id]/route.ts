import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const shopId = await getShopId();
    const { id } = await params;

    const product = await db.product.findFirst({
      where: { id, shopId, isActive: true },
      include: {
        movements: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!product) return apiError("Product not found", 404);
    return Response.json({ product });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to fetch product", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const shopId = await getShopId();
    const { id } = await params;
    const body = await req.json();

    const existing = await db.product.findFirst({ where: { id, shopId } });
    if (!existing) return apiError("Product not found", 404);

    const { name, itemCode, sku, category, unit, costPrice, sellPrice, lowStockAt, imageUrl, warrantyPeriod, isService, isWeighted, pluCode } = body;

    const product = await db.product.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(itemCode !== undefined && { itemCode: itemCode?.trim() || null }),
        ...(sku !== undefined && { sku: sku?.trim() || null }),
        ...(category !== undefined && { category: category?.trim() || null }),
        ...(unit && { unit }),
        ...(costPrice !== undefined && { costPrice: parseFloat(costPrice) }),
        ...(sellPrice !== undefined && { sellPrice: parseFloat(sellPrice) }),
        ...(lowStockAt !== undefined && { lowStockAt: parseFloat(lowStockAt) }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(warrantyPeriod !== undefined && { warrantyPeriod: warrantyPeriod?.trim() || null }),
        ...(isService !== undefined && { isService: !!isService }),
        ...(isWeighted !== undefined && { isWeighted: !!isWeighted }),
        ...(pluCode !== undefined && { pluCode: pluCode?.trim() || null }),
      },
    });

    return Response.json({ product });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to update product", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const shopId = await getShopId();
    const { id } = await params;

    const existing = await db.product.findFirst({ where: { id, shopId } });
    if (!existing) return apiError("Product not found", 404);

    const saleCount = await db.saleItem.count({ where: { productId: id } });

    if (saleCount === 0) {
      // No sales history — safe to hard delete (remove movements first to satisfy FK)
      await db.$transaction([
        db.stockMovement.deleteMany({ where: { productId: id } }),
        db.product.delete({ where: { id } }),
      ]);
    } else {
      // Has sales history — soft delete but clear SKU so it can be reused immediately
      await db.product.update({ where: { id }, data: { isActive: false, itemCode: null, sku: null } });
    }

    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to delete product", 500);
  }
}
