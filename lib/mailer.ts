import nodemailer from "nodemailer";

// Escapes user-controlled strings before interpolating them into HTML email bodies.
// Required because nodemailer bypasses React's auto-escaping — raw HTML template literals.
function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"eStoreMate" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`;

function baseLayout(content: string) {
  const logoHtml = `<img src="https://res.cloudinary.com/dej61fdjn/image/upload/v1783673328/dc34dcbd-5c2d-444a-a47c-46be06596de7_mbniau.png" alt="eStoreMate" style="height:60px;width:auto;object-fit:contain" />`;
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
      <div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #f3f4f6">
        ${logoHtml}
      </div>
      ${content}
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #f3f4f6">
        <p style="color:#d1d5db;font-size:11px;margin:0">Sent by eStoreMate · Smart Shop Manager</p>
      </div>
    </div>`;
}

export async function sendPasswordResetOTP(to: string, name: string, otp: string) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: "eStoreMate — Password Reset OTP",
    html: baseLayout(`
      <h2 style="font-size:18px;font-weight:600;color:#111827;margin:0 0 8px">Password Reset</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px">Hi ${escHtml(name)}, use the code below to reset your password. It expires in 15 minutes.</p>
      <div style="background:#f3f4f6;border-radius:8px;padding:20px;text-align:center;margin-bottom:16px">
        <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#111827;font-family:monospace">${otp}</span>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin:0">If you did not request this, you can safely ignore this email.</p>
    `),
  });
}

export async function sendLowStockEmail(
  to: string,
  ownerName: string,
  shopName: string,
  items: { name: string; qty: number }[]
) {
  const rows = items
    .map((i) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6">${escHtml(i.name)}</td><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-family:monospace;color:#dc2626">${i.qty}</td></tr>`)
    .join("");

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `⚠️ Low Stock Alert — ${escHtml(shopName)}`,
    html: baseLayout(`
      <h2 style="font-size:18px;font-weight:600;color:#111827;margin:0 0 4px">Low Stock Alert</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 20px">Hi ${escHtml(ownerName)}, the following items in <strong>${escHtml(shopName)}</strong> are running low and need restocking.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="background:#f9fafb">
          <th style="text-align:left;padding:8px;font-weight:600;color:#6b7280;border-bottom:2px solid #e5e7eb">Product</th>
          <th style="text-align:right;padding:8px;font-weight:600;color:#6b7280;border-bottom:2px solid #e5e7eb">Stock Left</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#6b7280;font-size:13px;margin:16px 0 0">Please restock these items to avoid disruptions.</p>
    `),
  });
}

export async function sendDailySummaryEmail(
  to: string,
  ownerName: string,
  shopName: string,
  salesCount: number,
  revenue: number
) {
  const date = new Date().toLocaleDateString("en-LK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `📊 Daily Summary — ${escHtml(shopName)}`,
    html: baseLayout(`
      <h2 style="font-size:18px;font-weight:600;color:#111827;margin:0 0 4px">Daily Sales Summary</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 20px">Hi ${escHtml(ownerName)}, here's how <strong>${escHtml(shopName)}</strong> performed on ${escHtml(date)}.</p>
      <div style="display:flex;gap:12px;margin-bottom:20px">
        <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;text-align:center">
          <p style="margin:0;font-size:28px;font-weight:700;color:#16a34a;font-family:monospace">${salesCount}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#15803d">Sales</p>
        </div>
        <div style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;text-align:center">
          <p style="margin:0;font-size:22px;font-weight:700;color:#1d4ed8;font-family:monospace">LKR ${revenue.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#1e40af">Revenue</p>
        </div>
      </div>
      <p style="color:#6b7280;font-size:13px;margin:0">Log in to eStoreMate for detailed reports.</p>
    `),
  });
}

interface ReceiptItem { name: string; itemCode?: string | null; quantity: number; unit: string; unitPrice: number; lineTotal: number; warrantyPeriod?: string | null; }
interface ReceiptData {
  saleId: string;
  shopName: string;
  shopAddress?: string | null;
  shopPhone?: string | null;
  customerName?: string | null;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  amountPaid?: number;
  createdAt: string | Date;
}

export async function sendReceiptEmail(to: string, data: ReceiptData, appUrl?: string) {
  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
  const date = new Date(data.createdAt).toLocaleString("en-LK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const ref = data.saleId.slice(-6).toUpperCase();
  const baseUrl = (appUrl || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const receiptUrl = baseUrl ? `${baseUrl}/r/${data.saleId}` : null;

  const itemRows = data.items.map((i) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6">${escHtml(i.name)}${i.itemCode ? `<br><span style="font-size:11px;color:#9ca3af;font-family:monospace">Code: ${escHtml(i.itemCode)}</span>` : ""}<br><span style="font-size:11px;color:#9ca3af">${i.quantity} ${escHtml(i.unit)} × ${fmt(i.unitPrice)}</span>${i.warrantyPeriod ? `<br><span style="font-size:11px;color:#9ca3af">Warranty: ${escHtml(i.warrantyPeriod)}</span>` : ""}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-family:monospace">${fmt(i.lineTotal)}</td>
    </tr>`).join("");

  const payLabel: Record<string, string> = { CASH: "Cash", CARD: "Card", ONLINE: "Online Transfer", CREDIT: "Credit" };
  const cashRows = data.paymentMethod === "CASH" && data.amountPaid && data.amountPaid > 0
    ? `<tr><td style="padding:4px 8px;color:#6b7280;font-size:13px">Cash Tendered</td><td style="padding:4px 8px;text-align:right;font-family:monospace;font-size:13px;color:#374151">${fmt(data.amountPaid)}</td></tr>` +
      (data.amountPaid > data.total
        ? `<tr><td style="padding:4px 8px;color:#6b7280;font-size:13px">Change</td><td style="padding:4px 8px;text-align:right;font-family:monospace;font-size:13px;color:#6b7280">${fmt(data.amountPaid - data.total)}</td></tr>`
        : "")
    : "";

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Receipt #${ref} — ${escHtml(data.shopName)}`,
    html: baseLayout(`
      <div style="text-align:center;padding-bottom:16px;border-bottom:1px solid #f3f4f6;margin-bottom:16px">
        <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 4px">${escHtml(data.shopName)}</h2>
        ${data.shopAddress ? `<p style="font-size:12px;color:#6b7280;margin:2px 0">${escHtml(data.shopAddress)}</p>` : ""}
        ${data.shopPhone  ? `<p style="font-size:12px;color:#6b7280;margin:2px 0">Tel: ${escHtml(data.shopPhone)}</p>` : ""}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#6b7280;margin-bottom:12px">
        <span>${escHtml(date)}</span><span>Receipt #${ref}</span>
      </div>
      ${data.customerName ? `<p style="font-size:13px;color:#6b7280;margin:0 0 12px">Customer: <strong>${escHtml(data.customerName)}</strong></p>` : ""}
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:12px">
        <thead><tr style="background:#f9fafb">
          <th style="text-align:left;padding:8px;font-weight:600;color:#6b7280;border-bottom:2px solid #e5e7eb">Item</th>
          <th style="text-align:right;padding:8px;font-weight:600;color:#6b7280;border-bottom:2px solid #e5e7eb">Amount</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${data.discount > 0 ? `<tr><td style="padding:4px 8px;color:#6b7280">Subtotal</td><td style="padding:4px 8px;text-align:right;font-family:monospace">${fmt(data.subtotal)}</td></tr><tr><td style="padding:4px 8px;color:#6b7280">Discount</td><td style="padding:4px 8px;text-align:right;font-family:monospace;color:#dc2626">−${fmt(data.discount)}</td></tr>` : ""}
        <tr style="border-top:2px solid #e5e7eb"><td style="padding:8px;font-weight:700;font-size:16px">Total</td><td style="padding:8px;text-align:right;font-family:monospace;font-weight:700;font-size:16px;color:#2DA86B">${fmt(data.total)}</td></tr>
        <tr><td style="padding:4px 8px;color:#6b7280">Payment</td><td style="padding:4px 8px;text-align:right;font-family:monospace">${payLabel[data.paymentMethod] ?? data.paymentMethod}</td></tr>
        ${cashRows}
      </table>
      <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px dashed #e5e7eb">
        <p style="font-weight:600;color:#111827;margin:0">Thank you — Come again!</p>
        <p style="font-size:12px;color:#9ca3af;margin:4px 0 0">Please keep this receipt for your records.</p>
        ${receiptUrl ? `
        <a href="${receiptUrl}" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#2DA86B;color:#fff;font-size:13px;font-weight:600;text-decoration:none;border-radius:8px">
          View &amp; Download PDF
        </a>
        <p style="font-size:11px;color:#d1d5db;margin:8px 0 0">Opens your receipt in the browser — use Print → Save as PDF to download.</p>
        ` : ""}
      </div>
    `),
  });
}

const DEFAULT_MAINTENANCE_MESSAGE =
  "System maintenance is in progress. Some features may be temporarily unavailable.";

export async function sendMaintenanceEmail(
  to: string,
  ownerName: string,
  shopName: string,
  customMessage?: string | null
) {
  const body = customMessage?.trim() || DEFAULT_MAINTENANCE_MESSAGE;
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `eStoreMate — Scheduled Maintenance Notice for ${escHtml(shopName)}`,
    html: baseLayout(`
      <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 8px">Maintenance Notice</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 20px">Hi ${escHtml(ownerName)},</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:18px">🔧</span>
          <span style="font-weight:600;color:#1e40af;font-size:15px">System Maintenance</span>
        </div>
        <p style="color:#1e3a8a;font-size:14px;margin:0">${escHtml(body)}</p>
      </div>
      <p style="color:#6b7280;font-size:13px;margin:0 0 8px">
        Your shop <strong style="color:#111827">${escHtml(shopName)}</strong> may experience limited functionality during this period.
        All your data is safe and will be fully accessible once maintenance is complete.
      </p>
      <p style="color:#6b7280;font-size:13px;margin:0">
        We apologise for any inconvenience. If you have urgent concerns, please contact our support team.
      </p>
    `),
  });
}

export async function sendCreditReminderEmail(
  to: string,
  customerName: string,
  shopName: string,
  creditBalance: number,
  pendingSales: { id: string; createdAt: Date; total: number; amountPaid: number }[],
) {
  const fmt = (n: number) => `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const salesRows = pendingSales.map((s) => {
    const due = s.total - s.amountPaid;
    const date = new Date(s.createdAt).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" });
    return `
      <tr>
        <td style="padding:8px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6">${date}</td>
        <td style="padding:8px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:right">${fmt(s.total)}</td>
        <td style="padding:8px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:right">${fmt(s.amountPaid)}</td>
        <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#DC2626;border-bottom:1px solid #f3f4f6;text-align:right">${fmt(due)}</td>
      </tr>`;
  }).join("");

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Payment Reminder — ${escHtml(shopName)}`,
    html: baseLayout(`
      <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 6px">Payment Reminder</h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 20px">From <strong>${escHtml(shopName)}</strong></p>

      <p style="font-size:14px;color:#374151;margin:0 0 16px">
        Dear <strong>${escHtml(customerName)}</strong>,<br/><br/>
        This is a friendly reminder that you have an outstanding credit balance with us.
        We would appreciate if you could settle the amount at your earliest convenience.
      </p>

      <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:13px;font-weight:600;color:#991B1B">Total Outstanding Balance</span>
        <span style="font-size:20px;font-weight:800;color:#DC2626;font-family:monospace">${fmt(creditBalance)}</span>
      </div>

      ${pendingSales.length > 0 ? `
      <p style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px">Outstanding Purchases</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #f3f4f6;border-radius:8px;overflow:hidden;margin-bottom:20px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#6b7280;text-align:left">Date</th>
            <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#6b7280;text-align:right">Total</th>
            <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#6b7280;text-align:right">Paid</th>
            <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#6b7280;text-align:right">Due</th>
          </tr>
        </thead>
        <tbody>${salesRows}</tbody>
      </table>` : ""}

      <p style="font-size:13px;color:#6b7280;margin:0">
        Please visit <strong>${escHtml(shopName)}</strong> or contact us to make your payment.<br/>
        Thank you for your continued business.
      </p>
    `),
  });
}

export async function sendMaintenanceBulkEmails(
  recipients: { email: string; ownerName: string; shopName: string }[],
  customMessage?: string | null
) {
  const results = await Promise.allSettled(
    recipients.map((r) =>
      sendMaintenanceEmail(r.email, r.ownerName, r.shopName, customMessage)
    )
  );
  const sent  = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  return { sent, failed };
}
