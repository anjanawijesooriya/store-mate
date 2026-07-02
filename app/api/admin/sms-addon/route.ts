import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return apiError("Unauthorized", 401);

  try {
    const { shopId, enabled } = await req.json();
    if (!shopId || typeof enabled !== "boolean") {
      return apiError("shopId and enabled (boolean) are required");
    }
    const shop = await db.shop.update({
      where: { id: shopId },
      data: { smsAddonEnabled: enabled },
      select: { id: true, name: true, smsAddonEnabled: true },
    });
    return Response.json({ success: true, shop });
  } catch {
    return apiError("Failed to update SMS addon", 500);
  }
}
