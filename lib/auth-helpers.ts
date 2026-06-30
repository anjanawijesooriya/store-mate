import { auth } from "@/auth";
import { db } from "@/lib/db";

export class UnauthorizedError extends Error {
  constructor(public reason: "unauthorized" | "device_revoked" = "unauthorized") {
    super(reason === "device_revoked" ? "Device removed" : "Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function getShopId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.shopId) throw new UnauthorizedError();
  return session.user.shopId;
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
  return Response.json(
    { error: "Unauthorized", reason: reason ?? "unauthorized" },
    { status: 401 }
  );
}
