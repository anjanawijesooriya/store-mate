import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const shopId = await getShopId();

    const products = await db.product.findMany({
      where: { shopId, isActive: true, isService: false },
      select: {
        id: true,
        name: true,
        itemCode: true,
        variants: {
          where: { isActive: true },
          orderBy: [{ size: "asc" }, { color: "asc" }],
          select: {
            id: true,
            size: true,
            color: true,
            sku: true,
            stockQty: true,
            lowStockAt: true,
            sellPrice: true,
          },
        },
      },
    });

    const rows = products
      .filter((p) => p.variants.length > 0)
      .flatMap((p) =>
        p.variants.map((v) => ({
          variantId: v.id,
          productName: p.name,
          itemCode: p.itemCode ?? null,
          size: v.size,
          color: v.color ?? null,
          sku: v.sku ?? null,
          stockQty: Number(v.stockQty),
          lowStockAt: Number(v.lowStockAt),
          sellPrice: v.sellPrice !== null ? Number(v.sellPrice) : null,
        }))
      );

    return Response.json({ variants: rows });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to fetch variants", 500);
  }
}
