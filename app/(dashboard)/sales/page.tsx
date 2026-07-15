import { Metadata } from "next";
import { SalesClient } from "./sales-client";

export const metadata: Metadata = { title: "Sales History" };

export default function SalesPage() {
  return <SalesClient />;
}
