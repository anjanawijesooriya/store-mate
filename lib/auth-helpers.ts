import { auth } from "@/auth";
import { db } from "@/lib/db";

export class UnauthorizedError extends Error {
  constructor(public reason: "unauthorized" | "device_revoked" | "non_primary" = "unauthorized") {
    super(
      reason === "device_revoked" ? "Device removed"
      : reason === "non_primary"  ? "Primary device only"
      : "Unauthorized"
    );
    this.name = "UnauthorizedError";
  }
}

export async function getShopId(): Promise<string> {
  const session = await getSession(); // includes device-revocation check
  return session.user.shopId;
}

// Use in routes restricted to the primary device (Reports, Expenses, Payroll).
// Throws UnauthorizedError("non_primary") when device lock is on and caller is not primary.
export async function requirePrimary(): Promise<string> {
  const session = await getSession();
  const { shopId, deviceId } = session.user;
  if (deviceId) {
    const [shop, device] = await Promise.all([
      db.shop.findUnique({ where: { id: shopId }, select: { deviceLockEnabled: true } }),
      db.deviceSession.findUnique({ where: { shopId_deviceId: { shopId, deviceId } }, select: { isPrimary: true } }),
    ]);
    if (shop?.deviceLockEnabled && !device?.isPrimary) {
      throw new UnauthorizedError("non_primary");
    }
  }
  return shopId;
}

export async function getShopWithPlan(): Promise<{ shopId: string; planTier: string; smsBalance: number }> {
  const session = await auth();
  if (!session?.user?.shopId) throw new UnauthorizedError();
  const shop = await db.shop.findUnique({
    where: { id: session.user.shopId },
    select: { planTier: true, smsBalance: true },
  });
  if (!shop) throw new UnauthorizedError();
  return { shopId: session.user.shopId, planTier: shop.planTier as string, smsBalance: Number(shop.smsBalance) };
}

export async function getSession() {
  const session = await auth();
  if (!session?.user?.shopId) throw new UnauthorizedError();

  // Verify device is still registered (catches remote revocations)
  const { shopId, deviceId } = session.user;
  if (deviceId) {
    const device = await db.deviceSession.findUnique({
      where: { shopId_deviceId: { shopId, deviceId } },
    });
    if (!device) throw new UnauthorizedError("device_revoked");

    // Update lastSeenAt async — don't block the request
    db.deviceSession.update({
      where: { shopId_deviceId: { shopId, deviceId } },
      data:  { lastSeenAt: new Date() },
    }).catch(() => {});
  }

  return session;
}

export function apiError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function apiUnauthorized(reason?: string) {
  if (reason === "non_primary") {
    return Response.json({ error: "Primary device only", reason }, { status: 403 });
  }
  return Response.json(
    { error: "Unauthorized", reason: reason ?? "unauthorized" },
    { status: 401 }
  );
}
