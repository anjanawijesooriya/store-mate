import { Metadata } from "next";
import { db } from "@/lib/db";
import { AdminBillingClient } from "./billing-client";

export const metadata: Metadata = { title: "Admin — Billing" };

export default async function AdminBillingPage() {
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
      _count: { select: { sales: true, products: true } },
      users: { where: { role: "OWNER" }, select: { email: true }, take: 1 },
    },
  });

  const serialized = shops.map(({ users, ...s }) => ({
    ...s,
    email: users[0]?.email ?? null,
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

  return <AdminBillingClient shops={serialized} />;
}
