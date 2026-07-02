import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";

export async function GET() {
  if (!(await isAdmin())) {
    return apiError("Forbidden", 403);
  }

  const shops = await db.shop.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      ownerName: true,
      phone: true,
      category: true,
      planTier: true,
      billingStatus: true,
      smsAddonEnabled: true,
      smsCredits: true,
      trialEndsAt: true,
      gracePeriodEndsAt: true,
      nextBillingDate: true,
      createdAt: true,
      payments: {
        orderBy: { paidAt: "desc" },
        select: { paidAt: true, amount: true, billingMonth: true, planTier: true, reference: true, note: true },
      },
      _count: { select: { sales: true, products: true } },
    },
  });

  return Response.json({ shops });
}
