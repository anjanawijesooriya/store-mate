import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export interface UpdateRow {
  name?: string | null;
  itemCode?: string | null;
  sku?: string | null;
  category?: string | null;
  unit?: string | null;
  costPrice?: number;
  sellPrice?: number;
  stockQty?: number;
  lowStockAt?: number;
  warrantyPeriod?: string | null;
}

export interface UpdateError {
  row: number;
  identifier: string;
  reason: string;
}

export async function POST(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const body = await req.json();
    const { rows } = body as { rows: UpdateRow[] };

    if (!Array.isArray(rows) || rows.length === 0) return apiError("No rows provided");
    if (rows.length > 5000) return apiError("Maximum 5,000 rows per update");

    let updated = 0;
    const errors: UpdateError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const itemCodeKey = row.itemCode?.trim();
      const skuKey = row.sku?.trim();
      const nameKey = row.name?.trim();
      const identifier = itemCodeKey || skuKey || nameKey || `row ${rowNum}`;

      // Identify product: item code → SKU → name (case-insensitive)
      let product: { id: string } | null = null;

      if (itemCodeKey) {
        product = await db.product.findFirst({
          where: { shopId, itemCode: itemCodeKey, isActive: true },
          select: { id: true },
        });
      }
      if (!product && skuKey) {
        product = await db.product.findFirst({
          where: { shopId, sku: skuKey, isActive: true },
          select: { id: true },
        });
      }
      if (!product && nameKey) {
        product = await db.product.findFirst({
          where: { shopId, name: { equals: nameKey, mode: "insensitive" }, isActive: true },
          select: { id: true },
        });
      }

      if (!product) {
        errors.push({ row: rowNum, identifier, reason: "Product not found" });
        continue;
      }

      // Only include fields that were explicitly provided
      const data: Record<string, unknown> = {};
      if (row.sellPrice !== undefined)     data.sellPrice     = row.sellPrice;
      if (row.costPrice !== undefined)     data.costPrice     = row.costPrice;
      if (row.lowStockAt !== undefined)    data.lowStockAt    = row.lowStockAt;
      if (row.stockQty !== undefined)      data.stockQty      = row.stockQty;
      if (row.category !== undefined)      data.category      = row.category?.trim() || null;
      if (row.unit !== undefined && row.unit?.trim()) data.unit = row.unit.trim();
      if (row.warrantyPeriod !== undefined) data.warrantyPeriod = row.warrantyPeriod?.trim() || null;

      if (Object.keys(data).length === 0) {
        errors.push({ row: rowNum, identifier, reason: "No fields to update" });
        continue;
      }

      try {
        await db.product.update({ where: { id: product.id }, data });
        updated++;
      } catch (err) {
        console.error(err);
        errors.push({ row: rowNum, identifier, reason: "Update failed" });
      }
    }

    return Response.json({ updated, errors });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    console.error(err);
    return apiError("Bulk update failed", 500);
  }
}
