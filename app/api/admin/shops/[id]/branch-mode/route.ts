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
    data: { branchModeEnabled: enabled },
    select: { id: true, branchModeEnabled: true },
  });

  // When disabling branch mode, clear all primary flags
  if (!enabled) {
    await db.deviceSession.updateMany({ where: { shopId }, data: { isPrimary: false } });
  }

  return Response.json({ success: true, branchModeEnabled: shop.branchModeEnabled });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return apiError("Unauthorized", 401);

  const { id: shopId } = await params;

  // Reset primary device — e.g. lost/broken device situation
  await db.deviceSession.updateMany({ where: { shopId }, data: { isPrimary: false } });

  return Response.json({ success: true, message: "Primary device cleared. Owner must set a new primary from Settings." });
}
