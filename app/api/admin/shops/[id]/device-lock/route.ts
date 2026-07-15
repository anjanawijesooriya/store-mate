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
    data: { deviceLockEnabled: enabled },
    select: { id: true, deviceLockEnabled: true },
  });

  // When disabling device lock, clear all primary flags so no stale primaries remain
  if (!enabled) {
    await db.deviceSession.updateMany({ where: { shopId }, data: { isPrimary: false } });
  }

  return Response.json({ success: true, deviceLockEnabled: shop.deviceLockEnabled });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return apiError("Unauthorized", 401);

  const { id: shopId } = await params;

  await db.deviceSession.updateMany({ where: { shopId }, data: { isPrimary: false } });

  return Response.json({ success: true, message: "Primary device cleared. Owner must set a new primary from Settings." });
}
