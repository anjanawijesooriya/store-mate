import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { BranchGuard } from "@/components/dashboard/branch-guard";
import { GrnDetailClient } from "./grn-detail-client";

export default async function GrnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.shopId) redirect("/login");

  const shop = await db.shop.findUnique({
    where: { id: session.user.shopId },
    select: { variantsEnabled: true, weightedProductsEnabled: true },
  });

  const { id } = await params;
  return (
    <BranchGuard>
      <GrnDetailClient
        id={id}
        variantsEnabled={shop?.variantsEnabled ?? false}
        weightedProductsEnabled={shop?.weightedProductsEnabled ?? false}
      />
    </BranchGuard>
  );
}
