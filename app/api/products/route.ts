import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const category = searchParams.get("category") ?? "";
    const filter = searchParams.get("filter") ?? "";
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "50");

    // For low-stock we need a raw query since Prisma can't compare two columns
    if (filter === "low-stock") {
      const products = await db.$queryRaw<Array<{
        id: string; name: string; sku: string | null; category: string | null;
        unit: string; "costPrice": string; "sellPrice": string; "stockQty": string;
        "lowStockAt": string; "imageUrl": string | null; "isActive": boolean;
        "createdAt": Date; "updatedAt": Date;
      }>>`
        SELECT * FROM "Product"
        WHERE "shopId" = ${shopId} AND "isActive" = true AND "stockQty" <= "lowStockAt"
        ORDER BY "stockQty" ASC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `;
      return Response.json({ products, total: products.length });
    }

    const where = {
      shopId,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { sku: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(category && { category }),
    };

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.product.count({ where }),
    ]);

    return Response.json({ products, total, page, limit });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    console.error(err);
    return apiError("Failed to fetch products", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const body = await req.json();
    const { name, sku, category, unit, costPrice, sellPrice, stockQty, lowStockAt, imageUrl } = body;

    if (!name || costPrice === undefined || sellPrice === undefined) {
      return apiError("Name, cost price and sell price are required");
    }

    if (sku) {
      const existing = await db.product.findUnique({ where: { shopId_sku: { shopId, sku } } });
      if (existing) return apiError("A product with this SKU already exists", 409);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const product = await db.$transaction(async (tx: any) => {
      const p = await tx.product.create({
        data: {
          shopId,
          name: name.trim(),
          sku: sku?.trim() || null,
          category: category?.trim() || null,
          unit: unit || "pcs",
          costPrice: parseFloat(costPrice),
          sellPrice: parseFloat(sellPrice),
          stockQty: parseFloat(stockQty ?? 0),
          lowStockAt: parseFloat(lowStockAt ?? 5),
          imageUrl: imageUrl || null,
        },
      });

      if (parseFloat(stockQty ?? 0) > 0) {
        await tx.stockMovement.create({
          data: {
            productId: p.id,
            type: "RESTOCK",
            quantity: parseFloat(stockQty),
            note: "Initial stock",
          },
        });
      }

      return p;
    });

    return Response.json({ product }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    console.error(err);
    return apiError("Failed to create product", 500);
  }
}
