import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function DELETE(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const { ids } = (await req.json()) as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) return apiError("No IDs provided");
    if (ids.length > 500) return apiError("Maximum 500 products per bulk delete");

    // Verify all IDs belong to this shop
    const owned = await db.product.findMany({
      where: { id: { in: ids }, shopId },
      select: { id: true },
    });
    const validIds = owned.map((p) => p.id);
    if (validIds.length === 0) return apiError("No matching products found", 404);

    // Split into hard-delete (no sales history) and soft-delete
    const withSales = await db.saleItem.groupBy({
      by: ["productId"],
      where: { productId: { in: validIds } },
    });
    const withSalesSet = new Set(withSales.map((s) => s.productId));
    const hardIds = validIds.filter((id) => !withSalesSet.has(id));
    const softIds = validIds.filter((id) => withSalesSet.has(id));

    await db.$transaction([
      db.stockMovement.deleteMany({ where: { productId: { in: hardIds } } }),
      db.product.deleteMany({ where: { id: { in: hardIds } } }),
      db.product.updateMany({
        where: { id: { in: softIds } },
        data: { isActive: false, itemCode: null, sku: null },
      }),
    ]);

    return Response.json({ deleted: validIds.length });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    console.error(err);
    return apiError("Bulk delete failed", 500);
  }
}
