import { Metadata } from "next";
import { auth } from "@/auth";
import { ReportsClient } from "./reports-client";
import { BranchGuard } from "@/components/dashboard/branch-guard";

export const metadata: Metadata = { title: "Sales Reports" };

export default async function ReportsPage() {
  return <BranchGuard><ReportsClient /></BranchGuard>;
}
