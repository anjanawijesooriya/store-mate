import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";
import { GRNStatus } from "@/lib/generated/prisma/enums";

export async function GET(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as GRNStatus | "ALL" | null;
    const validStatuses = ["DRAFT", "CONFIRMED", "CANCELLED"];
    if (status && status !== "ALL" && !validStatuses.includes(status)) {
      return apiError("Invalid status filter", 400);
    }
    const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = 20;

    const where = {
      shopId,
      ...(status && status !== "ALL" ? { status: status as GRNStatus } : {}),
    };

    const [grns, total] = await Promise.all([
      db.gRN.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          supplierName: true,
          referenceNo: true,
          status: true,
          confirmedAt: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      }),
      db.gRN.count({ where }),
    ]);

    return Response.json({ grns, total, page, limit });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to fetch GRNs", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const shopId = await getShopId();

    const shop = await db.shop.findUnique({ where: { id: shopId }, select: { grnEnabled: true } });
    if (!shop?.grnEnabled) return apiError("GRN module not enabled", 403);

    const body = await req.json().catch(() => ({}));
    const { supplierName, referenceNo, note } = body;

    const grn = await db.gRN.create({
      data: {
        shopId,
        supplierName: supplierName?.trim() || null,
        referenceNo:  referenceNo?.trim()  || null,
        note:         note?.trim()         || null,
      },
      select: { id: true },
    });

    return Response.json({ grn }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to create GRN", 500);
  }
}
