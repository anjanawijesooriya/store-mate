import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function GET(_req: NextRequest) {
  try {
    const shopId = await getShopId();
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: { payrollEnabled: true, grnEnabled: true },
    });
    return Response.json({
      payrollEnabled: shop?.payrollEnabled ?? false,
      grnEnabled:     shop?.grnEnabled     ?? false,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to fetch features", 500);
  }
}
