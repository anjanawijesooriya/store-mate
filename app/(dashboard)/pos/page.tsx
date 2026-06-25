import { Metadata } from "next";
import { POSClient } from "./pos-client";

export const metadata: Metadata = { title: "Point of Sale" };

export default function POSPage() {
  return <POSClient />;
}
