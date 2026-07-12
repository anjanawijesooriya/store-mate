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
      cardSurchargeEnabled: true,
      payrollEnabled: true,
      variantsEnabled: true,
      isLifetime: true,
      maintenanceDueDate: true,
      maintenancePaidUntil: true,
      trialEndsAt: true,
      gracePeriodEndsAt: true,
      nextBillingDate: true,
      createdAt: true,
      payments: {
        orderBy: { paidAt: "desc" },
        select: { paidAt: true, amount: true, billingMonth: true, planTier: true, reference: true, note: true },
      },
      maintenancePayments: {
        orderBy: { paidAt: "desc" },
        select: { id: true, amount: true, method: true, reference: true, note: true, periodStart: true, periodEnd: true, paidAt: true },
      },
      _count: { select: { sales: true } },
      users: {
        where:  { role: "OWNER" },
        select: { email: true },
        take:   1,
      },
    },
  });

  const inventoryRows = await db.$queryRaw<{ shopId: string; products: bigint; services: bigint }[]>`
    SELECT
      "shopId",
      COUNT(*) FILTER (WHERE "isService" = false AND "isActive" = true) AS products,
      COUNT(*) FILTER (WHERE "isService" = true  AND "isActive" = true) AS services
    FROM "Product"
    GROUP BY "shopId"
  `;
  const inventoryMap = new Map(inventoryRows.map((r) => [r.shopId, {
    products: Number(r.products),
    services: Number(r.services),
  }]));

  const result = shops.map(({ users, ...s }) => ({
    ...s,
    email: users[0]?.email ?? null,
    productsCount: inventoryMap.get(s.id)?.products ?? 0,
    servicesCount: inventoryMap.get(s.id)?.services ?? 0,
    smsBalance: Number(s.smsBalance),
    maintenanceDueDate:   s.maintenanceDueDate?.toISOString() ?? null,
    maintenancePaidUntil: s.maintenancePaidUntil?.toISOString() ?? null,
    payments: s.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    maintenancePayments: s.maintenancePayments.map((p) => ({
      ...p,
      amount:      Number(p.amount),
      periodStart: p.periodStart.toISOString(),
      periodEnd:   p.periodEnd.toISOString(),
      paidAt:      p.paidAt.toISOString(),
    })),
  }));

  return Response.json({ shops: result });
}
