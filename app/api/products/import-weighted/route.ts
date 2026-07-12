import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";
import { MovementType } from "@/lib/generated/prisma/enums";

const MEASURE_UNITS = ["kg", "g", "l", "ml"] as const;
type MeasureUnit = typeof MEASURE_UNITS[number];

export interface ImportWeightedRow {
  name: string;
  itemCode?: string | null;
  unit?: string | null;
  pluCode?: string | null;
  category?: string | null;
  costPrice?: number;
  sellPrice: number;
  lowStockAt?: number;
}

export interface ImportWeightedError {
  row: number;
  name: string;
  reason: string;
}

export async function POST(req: NextRequest) {
  try {
    const shopId = await getShopId();

    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: { planTier: true, weightedProductsEnabled: true },
    });
    if (!shop) return apiError("Shop not found", 404);
    if (!shop.weightedProductsEnabled) return apiError("Weighted products are not enabled for this shop", 403);

    const body = await req.json();
    const { rows } = body as { rows: ImportWeightedRow[] };

    if (!Array.isArray(rows) || rows.length === 0) return apiError("No rows provided");
    if (rows.length > 5000) return apiError("Maximum 5,000 rows per import");

    let upserted = 0;
    const errors: ImportWeightedError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const nameKey = row.name?.trim();

      if (!nameKey) {
        errors.push({ row: rowNum, name: "", reason: "Name is required" });
        continue;
      }
      if (row.sellPrice === undefined || row.sellPrice === null || row.sellPrice < 0) {
        errors.push({ row: rowNum, name: nameKey, reason: "Sell Price is required and must be ≥ 0" });
        continue;
      }
      // Resolve and validate unit — default kg
      const rawUnit = row.unit?.trim().toLowerCase() ?? "";
      const unit: MeasureUnit = (MEASURE_UNITS as readonly string[]).includes(rawUnit)
        ? (rawUnit as MeasureUnit)
        : "kg";
      const isScaleUnit = unit === "kg" || unit === "g";
      if (row.pluCode && !isScaleUnit) {
        // PLU codes only apply to scale (weight) products — ignore silently
      } else if (row.pluCode && !/^\d{1,5}$/.test(row.pluCode.trim())) {
        errors.push({ row: rowNum, name: nameKey, reason: "PLU Code must be 1–5 digits" });
        continue;
      }
      const pluCode = (isScaleUnit && row.pluCode) ? row.pluCode.trim().padStart(5, "0") : null;

      try {
        // Find existing by itemCode → name (case-insensitive)
        let existing: { id: string; stockQty: unknown } | null = null;
        if (row.itemCode?.trim()) {
          existing = await db.product.findFirst({
            where: { shopId, itemCode: row.itemCode.trim(), isActive: true },
            select: { id: true, stockQty: true },
          });
        }
        if (!existing) {
          existing = await db.product.findFirst({
            where: { shopId, name: { equals: nameKey, mode: "insensitive" }, isActive: true },
            select: { id: true, stockQty: true },
          });
        }

        if (existing) {
          // Update existing product — mark as weighted, update unit + PLU + prices
          await db.product.update({
            where: { id: existing.id },
            data: {
              isWeighted: true,
              unit,
              pluCode,
              ...(row.itemCode?.trim() && { itemCode: row.itemCode.trim() }),
              ...(row.category?.trim() && { category: row.category.trim() }),
              ...(row.sellPrice !== undefined && { sellPrice: row.sellPrice }),
              ...(row.costPrice !== undefined && { costPrice: row.costPrice }),
              ...(row.lowStockAt !== undefined && { lowStockAt: row.lowStockAt }),
            },
          });
        } else {
          // Create new weighted product
          if (shop.planTier === "BASIC") {
            const count = await db.product.count({ where: { shopId, isActive: true, isService: false } });
            if (count >= 500) {
              errors.push({ row: rowNum, name: nameKey, reason: "Basic plan limit of 500 products reached" });
              continue;
            }
          }
          await db.product.create({
            data: {
              shopId,
              name: nameKey,
              itemCode: row.itemCode?.trim() || null,
              sku: null,
              category: row.category?.trim() || null,
              unit,
              costPrice: row.costPrice ?? 0,
              sellPrice: row.sellPrice,
              stockQty: 0,
              lowStockAt: row.lowStockAt ?? 0,
              isWeighted: true,
              pluCode,
              isService: false,
            },
          });
        }

        upserted++;
      } catch (err) {
        const isUnique =
          (err as { code?: string }).code === "P2002" ||
          (err instanceof Error && err.message.toLowerCase().includes("unique constraint"));
        errors.push({
          row: rowNum,
          name: nameKey,
          reason: isUnique ? "Item Code already used by another product" : "Failed to save product",
        });
      }
    }

    return Response.json({ upserted, errors });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    console.error(err);
    return apiError("Weighted import failed", 500);
  }
}
