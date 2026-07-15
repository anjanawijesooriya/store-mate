import { BranchGuard } from "@/components/dashboard/branch-guard";
import { GrnListClient } from "./grn-list-client";

export default function GrnPage() {
  return <BranchGuard><GrnListClient /></BranchGuard>;
}
