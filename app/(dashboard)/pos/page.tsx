import { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { POSClient } from "./pos-client";

export const metadata: Metadata = { title: "Point of Sale" };

export default async function POSPage() {
  const session = await auth();
  if (!session?.user?.shopId) redirect("/login");

  const shop = await db.shop.findUnique({
    where: { id: session.user.shopId },
    select: { billingStatus: true, name: true },
  });

  if (shop?.billingStatus === "LOCKED") {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4 gap-6">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <Lock className="h-8 w-8 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">POS Locked</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            New sales are disabled because your subscription payment is overdue.
            You can still view reports and past data. Contact us via WhatsApp to restore access.
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 max-w-sm">
          All your data is safe — no records have been deleted.
          Access is restored immediately once payment is confirmed.
        </div>
      </div>
    );
  }

  return <POSClient />;
}
