import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";
import { BillingStatus } from "@/lib/generated/prisma/enums";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return apiError("Unauthorized", 401);

  const { id: shopId } = await params;
  const body = await req.json().catch(() => ({}));
  const enable: boolean = !!body.enable;

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 7);

  const shop = await db.shop.update({
    where: { id: shopId },
    data: {
      isLifetime: enable,
      ...(enable
        ? {
            // Enabling: force ACTIVE, clear billing dates so cron never touches it
            billingStatus: BillingStatus.ACTIVE,
            nextBillingDate: null,
            gracePeriodEndsAt: null,
            trialEndsAt: null,
          }
        : {
            // Disabling: revert to TRIAL with 7-day grace to arrange monthly billing
            billingStatus: BillingStatus.TRIAL,
            trialEndsAt,
            nextBillingDate: null,
            gracePeriodEndsAt: null,
          }),
    },
    select: { id: true, isLifetime: true, billingStatus: true },
  });

  return Response.json({ success: true, isLifetime: shop.isLifetime });
}
