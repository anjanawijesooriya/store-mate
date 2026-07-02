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
      users: { where: { role: "OWNER" }, select: { email: true }, take: 1 },
    },
  });

  const serialized = shops.map(({ users, ...s }) => ({
    ...s,
    email: users[0]?.email ?? null,
    payments: s.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
  }));

  return <AdminBillingClient shops={serialized} />;
}
