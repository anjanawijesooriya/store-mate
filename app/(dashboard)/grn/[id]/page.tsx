import { BranchGuard } from "@/components/dashboard/branch-guard";
import { GrnDetailClient } from "./grn-detail-client";

export default async function GrnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BranchGuard><GrnDetailClient id={id} /></BranchGuard>;
}
