import { NextRequest } from "next/server";
import { db } from "@/lib/db";

const DEVICE_LIMITS: Record<string, number> = {
  BASIC:    1,
  STANDARD: 3,
  PREMIUM:  Infinity,
};

export async function POST(req: NextRequest) {
  try {
    const { phone, deviceId } = await req.json();

    if (!phone || !deviceId) {
      return Response.json({ allowed: true }); // let signIn handle missing fields
    }

    const user = await db.user.findUnique({
      where: { phone: (phone as string).replace(/\D/g, "") },
      select: { shopId: true, shop: { select: { planTier: true } } },
    });

    if (!user) return Response.json({ allowed: true }); // unknown phone — let signIn return wrong-password

    const { shopId } = user;
    const planTier = user.shop.planTier as string;
    const limit = DEVICE_LIMITS[planTier] ?? 1;

    const existing = await db.deviceSession.findUnique({
      where: { shopId_deviceId: { shopId, deviceId } },
    });

    if (existing) return Response.json({ allowed: true }); // known device, always fine

    const count = await db.deviceSession.count({ where: { shopId } });
    if (count >= limit) {
      return Response.json({
        allowed: false,
        reason:  "device_limit",
        limit,
        plan: planTier,
      });
    }

    return Response.json({ allowed: true });
  } catch {
    return Response.json({ allowed: true }); // fail open — let signIn decide
  }
}
