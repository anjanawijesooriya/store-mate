import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export interface ImportVariantRow {
  variantId?: string | null; // stable ID from export — primary match key when present
  product: string;           // name, itemCode, or SKU of parent product
  size: string;
  color?: string | null;
  sku?: string | null;
  stockQty?: number;
  lowStockAt?: number;
  sellPrice?: number | null;
}

export interface ImportVariantError {
  row: number;
  product: string;
  size: string;
  reason: string;
}

export async function POST(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const { rows } = await req.json() as { rows: ImportVariantRow[] };

    if (!Array.isArray(rows) || rows.length === 0) return apiError("No rows provided");

    // Verify shop has variantsEnabled
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: { variantsEnabled: true },
    });
    if (!shop?.variantsEnabled) return apiError("Variants are not enabled for this shop", 403);

    // Pre-load all active products for this shop (lookup by name, itemCode, SKU)
    const products = await db.product.findMany({
      where: { shopId, isActive: true, isService: false },
      select: { id: true, name: true, itemCode: true, sku: true },
    });
    const byName     = new Map(products.map((p) => [p.name.toLowerCase().trim(), p.id]));
    const byItemCode = new Map(products.filter((p) => p.itemCode).map((p) => [p.itemCode!.toLowerCase().trim(), p.id]));
    const bySku      = new Map(products.filter((p) => p.sku).map((p) => [p.sku!.toLowerCase().trim(), p.id]));

    let upserted = 0;
    const errors: ImportVariantError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      const productKey = (row.product ?? "").trim();
      const size = (row.size ?? "").trim();

      if (!productKey) {
        errors.push({ row: rowNum, product: productKey, size, reason: "Product identifier is required" });
        continue;
      }
      if (!size) {
        errors.push({ row: rowNum, product: productKey, size, reason: "Size is required" });
        continue;
      }

      // Resolve parent product
      const lowerKey = productKey.toLowerCase();
      const productId = byItemCode.get(lowerKey) ?? bySku.get(lowerKey) ?? byName.get(lowerKey);
      if (!productId) {
        errors.push({ row: rowNum, product: productKey, size, reason: "Product not found — check Name, Item Code, or SKU" });
        continue;
      }

      const colorVal = row.color?.trim() || null;
      const variantIdVal = row.variantId?.trim() || null;

      try {
        // Prefer matching by Variant ID (from export) — allows changing size/colour
        let existingId: string | null = null;
        if (variantIdVal) {
          const byId = await db.productVariant.findFirst({
            where: { id: variantIdVal, productId },
            select: { id: true },
          });
          if (byId) existingId = byId.id;
        }
        // Fall back to size+colour match for manually added rows
        if (!existingId) {
          const bySizeColor = await db.productVariant.findFirst({
            where: { productId, size, color: colorVal },
            select: { id: true },
          });
          if (bySizeColor) existingId = bySizeColor.id;
        }

        if (existingId) {
          await db.productVariant.update({
            where: { id: existingId },
            data: {
              isActive:   true,
              size,
              color:      colorVal,
              sku:        row.sku?.trim() || null,
              ...(row.stockQty   !== undefined && { stockQty:   row.stockQty }),
              ...(row.lowStockAt !== undefined && { lowStockAt: row.lowStockAt }),
              ...(row.sellPrice  !== undefined && { sellPrice:  row.sellPrice ?? null }),
            },
          });
        } else {
          await db.productVariant.create({
            data: {
              productId,
              size,
              color:      colorVal,
              sku:        row.sku?.trim() || null,
              stockQty:   row.stockQty  ?? 0,
              lowStockAt: row.lowStockAt ?? 3,
              sellPrice:  row.sellPrice  ?? null,
            },
          });
        }
        upserted++;
      } catch {
        errors.push({ row: rowNum, product: productKey, size, reason: "Failed to save variant" });
      }
    }

    return Response.json({ upserted, errors }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    console.error("[POST /api/products/import-variants]", err);
    return apiError("Failed to import variants", 500);
  }
}
