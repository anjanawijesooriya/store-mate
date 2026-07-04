import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const session = await getSession();
    const shopId = session.user.shopId;
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true, name: true, ownerName: true, phone: true,
        category: true, address: true, planTier: true, trialEndsAt: true,
        billingStatus: true, gracePeriodEndsAt: true, nextBillingDate: true,
        smsAddonEnabled: true, smsLowStock: true, smsDailySummary: true, smsReceiptEnabled: true, smsBalance: true,
        emailLowStock: true, emailDailySummary: true, emailReceiptEnabled: true,
      },
    });
    if (!shop) return apiError("Shop not found", 404);
    return Response.json({ shop });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to fetch shop", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    const shopId  = session.user.shopId;
    const userId  = session.user.id;
    const body    = await req.json();
    const { name, ownerName, email, address } = body;

    const emailClean = email ? String(email).trim().toLowerCase() : undefined;
    if (emailClean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      return apiError("Invalid email address", 400);
    }

    const [shop] = await db.$transaction([
      db.shop.update({
        where: { id: shopId },
        data: {
          ...(name     && { name: name.trim() }),
          ...(ownerName && { ownerName: ownerName.trim() }),
          ...(address !== undefined && { address: address?.trim() || null }),
        },
      }),
      db.user.update({
        where: { id: userId },
        data: {
          ...(ownerName  && { name: ownerName.trim() }),
          ...(emailClean !== undefined && { email: emailClean || null }),
        },
      }),
    ]);

    return Response.json({ shop });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to update shop", 500);
  }
}

