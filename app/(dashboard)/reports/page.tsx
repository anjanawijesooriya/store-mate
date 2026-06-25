import { Metadata } from "next";
import { ReportsClient } from "./reports-client";

export const metadata: Metadata = { title: "Sales Reports" };

export default function ReportsPage() {
  return <ReportsClient />;
}
