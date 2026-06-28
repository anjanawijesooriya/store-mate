import { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.shopId) redirect("/login");

  const shop = await db.shop.findUnique({
    where: { id: session.user.shopId },
    select: {
      id: true, name: true, ownerName: true, phone: true,
      category: true, address: true, planTier: true, trialEndsAt: true,
      smsLowStock: true, smsDailySummary: true, smsReceiptEnabled: true, smsMonthlyUsage: true,
      billingStatus: true, gracePeriodEndsAt: true, nextBillingDate: true,
      payments: {
        orderBy: { paidAt: "desc" },
        take: 12,
        select: {
          id: true, amount: true, currency: true, method: true,
          reference: true, planTier: true, billingMonth: true, note: true, paidAt: true,
        },
      },
    },
  });

  if (!shop) redirect("/login");

  const serialized = {
    ...shop,
    payments: shop.payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
    })),
  };

  return <SettingsClient shop={serialized} />;
}
