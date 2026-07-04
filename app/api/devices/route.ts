import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const session = await getSession();
    const { shopId, deviceId: currentDeviceId } = session.user;

    const devices = await db.deviceSession.findMany({
      where: { shopId },
      orderBy: { lastSeenAt: "desc" },
    });

    return Response.json({
      devices: devices.map((d) => ({
        id:          d.id,
        deviceId:    d.deviceId,
        deviceName:  d.deviceName ?? "Unknown device",
        lastSeenAt:  d.lastSeenAt,
        createdAt:   d.createdAt,
        isCurrent:   d.deviceId === currentDeviceId,
        isPrimary:   d.isPrimary,
      })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to fetch devices", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    const { shopId, deviceId: currentDeviceId } = session.user;
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get("id"); // DeviceSession.id (not deviceId)

    if (!targetId) return apiError("Device ID required");

    const device = await db.deviceSession.findFirst({
      where: { id: targetId, shopId },
    });

    if (!device) return apiError("Device not found", 404);

    if (device.deviceId === currentDeviceId) {
      return apiError("Cannot remove your current device. Sign out from this device instead.");
    }

    await db.deviceSession.delete({ where: { id: targetId } });

    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to remove device", 500);
  }
}
