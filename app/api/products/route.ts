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
    const type = searchParams.get("type") ?? ""; // "service" | "product" | "" (all)
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "50");

    // For low-stock we need a raw query since Prisma can't compare two columns.
    // Services are never low-stock so always excluded from this view.
    if (filter === "low-stock") {
      const products = await db.$queryRaw<Array<{
        id: string; name: string; sku: string | null; category: string | null;
        unit: string; "costPrice": string; "sellPrice": string; "stockQty": string;
        "lowStockAt": string; "imageUrl": string | null; "isActive": boolean;
        "isService": boolean; "createdAt": Date; "updatedAt": Date;
      }>>`
        SELECT * FROM "Product"
        WHERE "shopId" = ${shopId} AND "isActive" = true AND "isService" = false AND "stockQty" <= "lowStockAt"
        ORDER BY LOWER(name) ASC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `;
      return Response.json({ products, total: products.length });
    }

    const where = {
      shopId,
      isActive: true,
      ...(type === "service" && { isService: true }),
      ...(type === "product" && { isService: false }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { sku: { contains: search, mode: "insensitive" as const } },
          { itemCode: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(category && { category }),
    };

    const [rawProducts, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { variants: { where: { isActive: true } } } },
          variants: { where: { isActive: true }, select: { sellPrice: true } },
        },
      }),
      db.product.count({ where }),
    ]);

    const products = rawProducts.map(({ variants, ...p }) => {
      if (variants.length === 0) return { ...p, variantPriceMin: null, variantPriceMax: null };
      // Treat null override as base sell price so range reflects all actual prices
      const prices = variants.map((v) => v.sellPrice !== null ? Number(v.sellPrice) : Number(p.sellPrice));
      return {
        ...p,
        variantPriceMin: Math.min(...prices),
        variantPriceMax: Math.max(...prices),
      };
    });

    return Response.json({ products, total, page, limit });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    console.error(err);
    return apiError("Failed to fetch products", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const shopId = await getShopId();

    // BASIC plan: max 500 active products
    const shop = await db.shop.findUnique({ where: { id: shopId }, select: { planTier: true } });
    if (shop?.planTier === "BASIC") {
      const count = await db.product.count({ where: { shopId, isActive: true } });
      if (count >= 500) return apiError("Product limit reached — Basic plan allows 500 products. Upgrade to Standard for unlimited.", 403);
    }

    const body = await req.json();
    const { name, itemCode, sku, category, unit, costPrice, sellPrice, stockQty, lowStockAt, imageUrl, warrantyPeriod, isService, isWeighted, pluCode } = body;

    if (!name || sellPrice === undefined) {
      return apiError("Name and sell price are required");
    }
    if (!isService && costPrice === undefined) {
      return apiError("Cost price is required for products");
    }

    if (itemCode) {
      const existing = await db.product.findUnique({ where: { shopId_itemCode: { shopId, itemCode: itemCode.trim() } } });
      if (existing) return apiError("A product with this item code already exists", 409);
    }

    if (sku) {
      const existing = await db.product.findUnique({ where: { shopId_sku: { shopId, sku } } });
      if (existing) return apiError("A product with this SKU already exists", 409);
    }

    const serviceMode = !!isService;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const product = await db.$transaction(async (tx: any) => {
      const p = await tx.product.create({
        data: {
          shopId,
          name: name.trim(),
          itemCode: itemCode?.trim() || null,
          sku: sku?.trim() || null,
          category: category?.trim() || null,
          unit: unit || (serviceMode ? "job" : "pcs"),
          costPrice: parseFloat(costPrice ?? 0),
          sellPrice: parseFloat(sellPrice),
          stockQty: serviceMode ? 0 : parseFloat(stockQty ?? 0),
          lowStockAt: serviceMode ? 0 : parseFloat(lowStockAt ?? 5),
          imageUrl: imageUrl || null,
          warrantyPeriod: serviceMode ? null : (warrantyPeriod?.trim() || null),
          isWeighted: !serviceMode && !!isWeighted,
          pluCode: !serviceMode && isWeighted ? (pluCode?.trim() || null) : null,
          isService: serviceMode,
        },
      });

      // Only create stock movement for physical products with opening stock
      if (!serviceMode && parseFloat(stockQty ?? 0) > 0) {
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
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    console.error(err);
    return apiError("Failed to create product", 500);
  }
}
