import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";
import { MovementType } from "@/lib/generated/prisma/enums";
export interface ImportRow {
  name: string;
  itemCode?: string | null;
  sku?: string | null;
  category?: string | null;
  unit?: string | null;
  costPrice: number;
  sellPrice: number;
  stockQty?: number;
  lowStockAt?: number;
  warrantyPeriod?: string | null;
}

export interface ImportError {
  row: number;
  name: string;
  reason: string;
}

export async function POST(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const body = await req.json();
    const { rows } = body as { rows: ImportRow[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      return apiError("No rows provided");
    }
    if (rows.length > 1000) {
      return apiError("Maximum 1,000 rows per import");
    }

    const [shop, currentCount] = await Promise.all([
      db.shop.findUnique({ where: { id: shopId }, select: { planTier: true } }),
      db.product.count({ where: { shopId, isActive: true, isService: false } }),
    ]);
    if (!shop) return apiError("Shop not found", 404);

    const BASIC_LIMIT = 500;
    let created = 0;
    const errors: ImportError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // row 1 = header, data starts at row 2

      if (shop.planTier === "BASIC" && currentCount + created >= BASIC_LIMIT) {
        errors.push({ row: rowNum, name: row.name, reason: `BASIC plan limit of ${BASIC_LIMIT} products reached` });
        continue;
      }

      try {
        const product = await db.product.create({
          data: {
            shopId,
            name: row.name.trim(),
            itemCode: row.itemCode?.trim() || null,
            sku: row.sku?.trim() || null,
            category: row.category?.trim() || null,
            unit: row.unit?.trim() || "pcs",
            costPrice: row.costPrice,
            sellPrice: row.sellPrice,
            stockQty: row.stockQty ?? 0,
            lowStockAt: row.lowStockAt ?? 5,
            warrantyPeriod: row.warrantyPeriod?.trim() || null,
            isService: false,
          },
        });

        if ((row.stockQty ?? 0) > 0) {
          await db.stockMovement.create({
            data: {
              productId: product.id,
              type: MovementType.RESTOCK,
              quantity: row.stockQty!,
              note: "Initial stock (imported)",
            },
          });
        }

        created++;
      } catch (err) {
        const isUniqueViolation =
          (err as { code?: string }).code === "P2002" ||
          (err instanceof Error && err.message.toLowerCase().includes("unique constraint"));
        errors.push({
          row: rowNum,
          name: row.name,
          reason: isUniqueViolation ? "SKU already exists in your inventory" : "Failed to create product",
        });
      }
    }

    return Response.json({ created, errors });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    console.error(err);
    return apiError("Import failed", 500);
  }
}
