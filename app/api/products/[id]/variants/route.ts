import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const shopId = await getShopId();
    const { id: productId } = await params;

    const product = await db.product.findUnique({ where: { id: productId, shopId }, select: { id: true } });
    if (!product) return apiError("Product not found", 404);

    const variants = await db.productVariant.findMany({
      where: { productId, isActive: true },
      orderBy: [{ size: "asc" }, { color: "asc" }],
    });

    return Response.json({ variants });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to fetch variants", 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const shopId = await getShopId();
    const { id: productId } = await params;

    const product = await db.product.findUnique({ where: { id: productId, shopId }, select: { id: true } });
    if (!product) return apiError("Product not found", 404);

    const body = await req.json();
    const { size, color, sku, stockQty, lowStockAt, sellPrice } = body;

    if (!size?.trim()) return apiError("Size is required");

    const existing = await db.productVariant.findUnique({
      where: { productId_size_color: { productId, size: size.trim(), color: color?.trim() ?? null } },
    });
    if (existing) return apiError("A variant with this size and colour already exists", 409);

    const variant = await db.productVariant.create({
      data: {
        productId,
        size: size.trim(),
        color: color?.trim() || null,
        sku: sku?.trim() || null,
        stockQty: parseFloat(stockQty ?? 0),
        lowStockAt: parseFloat(lowStockAt ?? 3),
        sellPrice: sellPrice ? parseFloat(sellPrice) : null,
      },
    });

    return Response.json({ variant }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to create variant", 500);
  }
}
