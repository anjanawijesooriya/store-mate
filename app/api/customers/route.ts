import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const shop = await db.shop.findUnique({ where: { id: shopId }, select: { planTier: true } });
    if (shop?.planTier === "BASIC") return apiError("Customer management requires Standard plan or higher.", 403);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "20");

    const where = {
      shopId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy: { totalSpent: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { sales: true } } },
      }),
      db.customer.count({ where }),
    ]);

    return Response.json({ customers, total, page, limit });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to fetch customers", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const shop = await db.shop.findUnique({ where: { id: shopId }, select: { planTier: true } });
    if (shop?.planTier === "BASIC") return apiError("Customer management requires Standard plan or higher.", 403);
    const body = await req.json();
    const { name, phone, email, address } = body;

    if (!name) return apiError("Customer name is required");

    const emailClean = email?.trim().toLowerCase() || null;
    if (emailClean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      return apiError("Invalid email address");
    }

    const customer = await db.customer.create({
      data: { shopId, name: name.trim(), phone: phone?.trim() || null, email: emailClean, address: address?.trim() || null },
    });

    return Response.json({ customer }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to create customer", 500);
  }
}

