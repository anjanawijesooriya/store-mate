"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { buildReceiptHtml, printReceiptHtml } from "@/lib/receipt-print";

interface ReceiptItem {
  name: string;
  itemCode?: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  warrantyPeriod?: string | null;
}

interface ReceiptData {
  shopName: string;
  shopPhone: string | null;
  shopAddress: string | null;
  customerName: string | null;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  createdAt: string;
  items: ReceiptItem[];
}

export function PrintButton({ saleId, shopName }: { saleId: string; shopName: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/receipt/${saleId}`);
      if (!res.ok) throw new Error("Failed to load receipt");
      const data: ReceiptData = await res.json();

      const html = buildReceiptHtml({
        ...data,
        refCode: saleId.slice(-6).toUpperCase(),
      });

      if (!printReceiptHtml(html)) {
        alert("Allow pop-ups to download the PDF");
      }
    } catch {
      alert("Could not load receipt. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      aria-label={`Download PDF receipt for ${shopName}`}
      className="fixed bottom-6 right-6 flex items-center gap-2 bg-[#2DA86B] hover:bg-[#25915c] disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg transition-colors"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {loading ? "Loading…" : "Download PDF"}
    </button>
  );
}
