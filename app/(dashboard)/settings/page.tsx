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
    },
  });

  if (!shop) redirect("/login");

  return <SettingsClient shop={shop} />;
}
