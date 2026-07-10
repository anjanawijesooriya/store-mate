import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PayrollClient } from "./payroll-client";
import { BranchGuard } from "@/components/dashboard/branch-guard";

export default async function PayrollPage() {
  const session = await auth();
  if (!session?.user?.shopId) redirect("/login");

  const shop = await db.shop.findUnique({
    where: { id: session.user.shopId },
    select: { payrollEnabled: true },
  });

  if (!shop?.payrollEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <div className="text-4xl">💼</div>
        <h2 className="text-xl font-semibold">Payroll is not enabled</h2>
        <p className="text-muted-foreground max-w-sm">
          The Payroll module is not enabled for your shop. Contact your eStoreMate provider to activate it.
        </p>
      </div>
    );
  }

  return <BranchGuard><PayrollClient /></BranchGuard>;
}
