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
      smsBalance: true,
      emailLowStock: true,
      emailDailySummary: true,
      emailReceiptEnabled: true,
      maintenanceBanner: true,
      maintenanceBannerMessage: true,
      branchModeEnabled: true,
      deviceLockEnabled: true,
      isLifetime: true,
      trialEndsAt: true,
      gracePeriodEndsAt: true,
      nextBillingDate: true,
      createdAt: true,
      payments: {
        orderBy: { paidAt: "desc" },
        select: { paidAt: true, amount: true, billingMonth: true, planTier: true, reference: true, note: true },
      },
      _count: { select: { sales: true, products: true } },
      users: {
        where:  { role: "OWNER" },
        select: { email: true },
        take:   1,
      },
    },
  });

  const result = shops.map(({ users, ...s }) => ({
    ...s,
    email: users[0]?.email ?? null,
    smsBalance: Number(s.smsBalance),
    payments: s.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
  }));

  return Response.json({ shops: result });
}
