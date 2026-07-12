import { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.shopId) redirect("/login");

  const [shop, owner] = await Promise.all([
    db.shop.findUnique({
      where: { id: session.user.shopId },
      select: {
        id: true, name: true, ownerName: true, phone: true,
        category: true, address: true, planTier: true, trialEndsAt: true,
        smsAddonEnabled: true, smsLowStock: true, smsDailySummary: true, smsReceiptEnabled: true, smsBalance: true,
        emailLowStock: true, emailDailySummary: true, emailReceiptEnabled: true,
        cardSurchargeEnabled: true, cardSurchargeRate: true,
        creditReminderEnabled: true,
        billingStatus: true, gracePeriodEndsAt: true, nextBillingDate: true, isLifetime: true,
        payments: {
          orderBy: { paidAt: "desc" },
          take: 12,
          select: {
            id: true, amount: true, currency: true, method: true,
            reference: true, planTier: true, billingMonth: true, note: true, paidAt: true,
          },
        },
      },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    }),
  ]);

  if (!shop) redirect("/login");

  const serialized = {
    ...shop,
    email: owner?.email ?? null,
    smsBalance: Number(shop.smsBalance),
    cardSurchargeRate: Number(shop.cardSurchargeRate ?? 0),
    payments: shop.payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
    })),
  };

  return <SettingsClient shop={serialized} />;
}
