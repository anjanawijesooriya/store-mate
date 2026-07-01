import { Metadata } from "next";
import { auth } from "@/auth";
import { ReportsClient } from "./reports-client";

export const metadata: Metadata = { title: "Sales Reports" };

export default async function ReportsPage() {
  const session = await auth();
  const planTier = (session?.user?.planTier ?? "BASIC") as string;
  return <ReportsClient planTier={planTier} />;
}
