import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const { shopId, deviceId } = session.user;

    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: { deviceLockEnabled: true },
    });

    if (!shop?.deviceLockEnabled) {
      return apiError("Device Lock is not enabled for this shop", 403);
    }

    const body = await req.json().catch(() => ({}));
    const targetDeviceSessionId: string | undefined = body.deviceSessionId;

    // If no target specified, set the current device as primary
    const targetDevice = targetDeviceSessionId
      ? await db.deviceSession.findFirst({ where: { id: targetDeviceSessionId, shopId } })
      : await db.deviceSession.findUnique({ where: { shopId_deviceId: { shopId, deviceId } } });

    if (!targetDevice) return apiError("Device not found", 404);

    // Clear all existing primaries for this shop, then set the new one
    await db.$transaction([
      db.deviceSession.updateMany({ where: { shopId }, data: { isPrimary: false } }),
      db.deviceSession.update({ where: { id: targetDevice.id }, data: { isPrimary: true } }),
    ]);

    return Response.json({ success: true, primaryDeviceId: targetDevice.deviceId });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to set primary device", 500);
  }
}
