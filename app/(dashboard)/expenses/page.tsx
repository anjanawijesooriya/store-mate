import { Metadata } from "next";
import { ExpensesClient } from "./expenses-client";
import { BranchGuard } from "@/components/dashboard/branch-guard";

export const metadata: Metadata = { title: "Expenses" };

export default function ExpensesPage() {
  return <BranchGuard><ExpensesClient /></BranchGuard>;
}
