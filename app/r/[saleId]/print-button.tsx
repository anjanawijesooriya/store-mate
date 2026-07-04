"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface ReceiptItem {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
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

const PAY_LABEL: Record<string, string> = {
  CASH: "Cash", CARD: "Card", ONLINE: "Online Transfer", CREDIT: "Credit",
};

function buildHtml(data: ReceiptData, saleId: string): string {
  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = new Date(data.createdAt).toLocaleString("en-LK", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const ref = saleId.slice(-6).toUpperCase();
  const change = data.amountPaid - data.total;

  const itemRows = data.items.map((i) => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px">${i.name}<br>
        <span style="font-size:11px;color:#888">${i.quantity} ${i.unit} × ${fmt(i.unitPrice)}</span>
      </td>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;font-family:monospace">${fmt(i.lineTotal)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt #${ref} — ${data.shopName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #fff; color: #111; }
    .page { max-width: 360px; margin: 0 auto; padding: 24px 20px; }
    .header { background: #2DA86B; color: #fff; text-align: center; padding: 18px 16px; border-radius: 10px 10px 0 0; margin: -24px -20px 20px; }
    .header h1 { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
    .header .total { font-size: 26px; font-weight: 700; margin: 6px 0 2px; }
    .header .pay { font-size: 12px; opacity: 0.8; }
    .shop-name { font-size: 17px; font-weight: 700; text-align: center; }
    .shop-sub { font-size: 12px; color: #666; text-align: center; margin-top: 2px; }
    .meta { display: flex; justify-content: space-between; font-size: 11px; color: #888; margin: 12px 0 8px; }
    .customer { font-size: 12px; color: #555; margin-bottom: 10px; }
    .section-label { font-size: 10px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; }
    .totals-table td { padding: 4px 0; font-size: 13px; }
    .total-row td { font-size: 15px; font-weight: 700; border-top: 1.5px solid #222; padding-top: 8px; }
    .divider { border: none; border-top: 1px dashed #ccc; margin: 14px 0; }
    .footer { text-align: center; margin-top: 16px; }
    .footer p { font-size: 12px; color: #555; font-weight: 600; }
    .footer small { font-size: 10px; color: #bbb; display: block; margin-top: 3px; }
    @media print {
      body { margin: 0; }
      .page { padding: 16px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="pay">${PAY_LABEL[data.paymentMethod] ?? data.paymentMethod} · Confirmed</div>
      <div class="total">${fmt(data.total)}</div>
    </div>

    <p class="shop-name">${data.shopName}</p>
    ${data.shopAddress ? `<p class="shop-sub">${data.shopAddress}</p>` : ""}
    ${data.shopPhone ? `<p class="shop-sub">${data.shopPhone}</p>` : ""}

    <div class="meta">
      <span>${date}</span>
      <span>Receipt #${ref}</span>
    </div>

    ${data.customerName ? `<p class="customer">Customer: <strong>${data.customerName}</strong></p>` : ""}

    <div class="section-label">Items</div>
    <table>
      <tbody>${itemRows}</tbody>
    </table>

    <hr class="divider" />

    <table class="totals-table">
      <tbody>
        ${data.discount > 0 ? `
        <tr><td>Subtotal</td><td style="text-align:right;font-family:monospace">${fmt(data.subtotal)}</td></tr>
        <tr><td style="color:#c00">Discount</td><td style="text-align:right;font-family:monospace;color:#c00">- ${fmt(data.discount)}</td></tr>` : ""}
        <tr class="total-row"><td>Total</td><td style="text-align:right;font-family:monospace;color:#2DA86B">${fmt(data.total)}</td></tr>
        <tr><td style="color:#555">Payment</td><td style="text-align:right;color:#555">${PAY_LABEL[data.paymentMethod] ?? data.paymentMethod}</td></tr>
        ${data.paymentMethod === "CASH" && data.amountPaid > data.total ? `
        <tr><td style="color:#555">Cash Paid</td><td style="text-align:right;font-family:monospace;color:#555">${fmt(data.amountPaid)}</td></tr>
        <tr><td style="color:#555">Change</td><td style="text-align:right;font-family:monospace;color:#555">${fmt(change)}</td></tr>` : ""}
      </tbody>
    </table>

    <hr class="divider" />

    <div class="footer">
      <p>Thank you — Come again!</p>
      <small>Powered by StoreMate</small>
    </div>
  </div>
</body>
</html>`;
}

export function PrintButton({ saleId, shopName }: { saleId: string; shopName: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/receipt/${saleId}`);
      if (!res.ok) throw new Error("Failed to load receipt");
      const data: ReceiptData = await res.json();

      const html = buildHtml(data, saleId);
      const w = window.open("", "_blank", "width=420,height=700");
      if (!w) { alert("Allow pop-ups to download the PDF"); return; }
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); }, 400);
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
