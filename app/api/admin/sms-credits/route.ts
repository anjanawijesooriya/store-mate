import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { apiError } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  const session = await auth();
  const adminPhone = process.env.NEXT_PUBLIC_ADMIN_PHONE;
  if (!adminPhone || session?.user?.phone?.replace(/\D/g, "") !== adminPhone.replace(/\D/g, "")) {
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
