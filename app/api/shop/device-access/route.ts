import { db } from "@/lib/db";
import { getSession, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const session = await getSession();
    const { shopId, deviceId } = session.user;

    const [shop, device] = await Promise.all([
      db.shop.findUnique({ where: { id: shopId }, select: { deviceLockEnabled: true } }),
      db.deviceSession.findUnique({
        where: { shopId_deviceId: { shopId, deviceId } },
        select: { isPrimary: true },
      }),
    ]);

    const deviceLockEnabled = shop?.deviceLockEnabled ?? false;
    const isPrimary = device?.isPrimary ?? false;

    return Response.json({ deviceLockEnabled, isPrimary });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to check device access", 500);
  }
}
