import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const shopId = await getShopId();

    const products = await db.product.findMany({
      where: { shopId, isActive: true, isWeighted: true },
      select: {
        name: true,
        itemCode: true,
        unit: true,
        pluCode: true,
        category: true,
        costPrice: true,
        sellPrice: true,
        lowStockAt: true,
      },
      orderBy: { name: "asc" },
    });

    return Response.json({ products });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to fetch weighted products", 500);
  }
}
