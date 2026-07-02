import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return apiError("Unauthorized", 401);
  }

  try {
    const { shopId, credits } = await req.json();
    if (!shopId || !credits || Number(credits) <= 0) {
      return apiError("shopId and a positive credits amount are required");
    }

    const shop = await db.shop.update({
      where: { id: shopId },
      data: { smsCredits: { increment: Number(credits) } },
      select: { id: true, name: true, smsCredits: true },
    });

    return Response.json({ success: true, shop });
  } catch {
    return apiError("Failed to add SMS credits", 500);
  }
}
