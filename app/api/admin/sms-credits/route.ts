import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return apiError("Unauthorized", 401);
  }

  try {
    const { shopId, amount, credits } = await req.json();
    const lkrAmount = Number(amount ?? credits ?? 0);
    if (!shopId || lkrAmount <= 0) {
      return apiError("shopId and a positive LKR amount are required");
    }

    const shop = await db.shop.update({
      where: { id: shopId },
      data: { smsBalance: { increment: lkrAmount } },
      select: { id: true, name: true, smsBalance: true },
    });

    return Response.json({ success: true, shop: { ...shop, smsBalance: Number(shop.smsBalance) } });
  } catch {
    return apiError("Failed to add SMS balance", 500);
  }
}
