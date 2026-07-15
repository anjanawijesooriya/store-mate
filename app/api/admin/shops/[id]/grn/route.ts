import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return apiError("Unauthorized", 401);

  const { id: shopId } = await params;
  const body = await req.json().catch(() => ({}));
  const enabled: boolean = !!body.enabled;

  try {
    const shop = await db.shop.update({
      where: { id: shopId },
      data: { grnEnabled: enabled },
      select: { id: true, grnEnabled: true },
    });
    return Response.json({ success: true, grnEnabled: shop.grnEnabled });
  } catch (e: unknown) {
    const pe = e as { code?: string };
    if (pe.code === "P2025") return apiError("Shop not found", 404);
    throw e;
  }
}
