// Single source of truth for the printable 80mm thermal receipt.
// Used by both the POS "Print" button and the shared-link "Download PDF" button —
// fix layout/print bugs here once instead of in N duplicated templates.

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ReceiptPrintItem {
  name: string;
  itemCode?: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  warrantyPeriod?: string | null;
}

export interface ReceiptPrintData {
  shopName: string;
  shopAddress?: string | null;
  shopPhone?: string | null;
  customerName?: string | null;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  createdAt: string | Date;
  items: ReceiptPrintItem[];
  refCode: string;
}

const PAY_LABEL: Record<string, string> = {
  CASH: "Cash", CARD: "Card", ONLINE: "Online Transfer", CREDIT: "Credit",
};

function fmt(n: number) {
  return `LKR ${Number(n).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function buildReceiptHtml(data: ReceiptPrintData): string {
  const date = new Date(data.createdAt).toLocaleString("en-LK", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const change = data.amountPaid - data.total;

  const itemRows = data.items.map((i) => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px;word-break:break-word;">${escHtml(i.name)}${i.itemCode ? `<br><span style="font-size:11px;color:#9ca3af;font-family:monospace">Code: ${escHtml(i.itemCode)}</span>` : ""}<br>
        <span style="font-size:11px;color:#888">${i.quantity} ${escHtml(i.unit)} × ${fmt(i.unitPrice)}</span>${i.warrantyPeriod ? `<br><span style="font-size:11px;color:#888">Warranty: ${escHtml(i.warrantyPeriod)}</span>` : ""}
      </td>
      <td style="padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;font-family:monospace;white-space:nowrap;">${fmt(i.lineTotal)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt #${escHtml(data.refCode)} — ${escHtml(data.shopName)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #fff; color: #111; }
    .page { max-width: 360px; margin: 0 auto; padding: 24px 20px; }
    .header { background: #2DA86B; color: #fff; text-align: center; padding: 18px 16px; border-radius: 10px 10px 0 0; margin: -24px -20px 20px; }
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
    /* 80mm thermal roll: auto page length so the printer cuts right after the
       content instead of feeding a full fixed-length page (the long blank tail). */
    @page {
      size: 80mm auto;
      margin: 0;
    }
    @media print {
      html, body { width: 80mm; }
      body { margin: 0; }
      .page { max-width: 80mm; width: 80mm; padding: 3mm 3mm; margin: 0; }
      .header { margin: -3mm -3mm 10px; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="pay">${escHtml(PAY_LABEL[data.paymentMethod] ?? data.paymentMethod)} · Confirmed</div>
      <div class="total">${fmt(data.total)}</div>
    </div>

    <p class="shop-name">${escHtml(data.shopName)}</p>
    ${data.shopAddress ? `<p class="shop-sub">${escHtml(data.shopAddress)}</p>` : ""}
    ${data.shopPhone ? `<p class="shop-sub">${escHtml(data.shopPhone)}</p>` : ""}

    <div class="meta">
      <span>${escHtml(date)}</span>
      <span>Receipt #${escHtml(data.refCode)}</span>
    </div>

    ${data.customerName ? `<p class="customer">Customer: <strong>${escHtml(data.customerName)}</strong></p>` : ""}

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
        <tr><td style="color:#555">Payment</td><td style="text-align:right;color:#555">${escHtml(PAY_LABEL[data.paymentMethod] ?? data.paymentMethod)}</td></tr>
        ${data.paymentMethod === "CASH" && data.amountPaid > data.total ? `
        <tr><td style="color:#555">Cash Paid</td><td style="text-align:right;font-family:monospace;color:#555">${fmt(data.amountPaid)}</td></tr>
        <tr><td style="color:#555">Change</td><td style="text-align:right;font-family:monospace;color:#555">${fmt(change)}</td></tr>` : ""}
        ${data.paymentMethod === "CREDIT" ? `
        <tr><td style="color:#dc2626;font-weight:600">Amount Due</td><td style="text-align:right;font-family:monospace;color:#dc2626;font-weight:600">${fmt(data.total)}</td></tr>` : ""}
      </tbody>
    </table>

    <hr class="divider" />

    <div class="footer">
      <p>Thank you — Come again!</p>
      <small>Powered by eStoreMate</small>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Opens a popup window, writes the receipt HTML, and triggers print once the
 * window has actually finished loading — rather than guessing with a blind
 * setTimeout, which can fire print before the @page/print styles are applied
 * on slower machines.
 */
export function printReceiptHtml(html: string): boolean {
  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) return false;

  w.document.write(html);
  w.document.close();

  const triggerPrint = () => {
    w.focus();
    w.print();
  };

  if (w.document.readyState === "complete") {
    setTimeout(triggerPrint, 150);
  } else {
    w.addEventListener("load", () => setTimeout(triggerPrint, 150));
  }

  return true;
}
