import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return apiError("Unauthorized", 401);

  const { id: shopId } = await params;
  const body = await req.json().catch(() => ({}));
  const enabled: boolean = !!body.enabled;

  const shop = await db.shop.update({
    where: { id: shopId },
    data: { variantsEnabled: enabled },
    select: { id: true, variantsEnabled: true },
  });

  return Response.json({ success: true, variantsEnabled: shop.variantsEnabled });
}
