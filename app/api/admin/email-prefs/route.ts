import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return apiError("Forbidden", 403);

  const { shopId, enabled } = await req.json();
  if (!shopId || typeof enabled !== "boolean") return apiError("shopId and enabled required");

  const shop = await db.shop.update({
    where: { id: shopId },
    data: {
      emailLowStock:       enabled,
      emailDailySummary:   enabled,
      emailReceiptEnabled: enabled,
    },
  });

  return Response.json({ shop });
}
