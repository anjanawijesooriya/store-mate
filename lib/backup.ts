import { db } from "@/lib/db";
import nodemailer from "nodemailer";

export type BackupType = "daily" | "weekly" | "manual";

// ── Mailer ───────────────────────────────────────────────────────────────────

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ── Data export ──────────────────────────────────────────────────────────────

async function exportAllData() {
  const [
    shops, users, products, sales, saleItems, customers,
    expenses, payments, stockMovements, smsLogs, backupLogs,
  ] = await Promise.all([
    db.shop.findMany(),
    db.user.findMany({ select: { id: true, shopId: true, name: true, phone: true, email: true, role: true, createdAt: true } }),
    db.product.findMany(),
    db.sale.findMany(),
    db.saleItem.findMany(),
    db.customer.findMany(),
    db.expense.findMany(),
    db.payment.findMany(),
    db.stockMovement.findMany(),
    db.smsLog.findMany({ orderBy: { createdAt: "desc" }, take: 1000 }),
    db.backupLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return {
    _meta: {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      tables: ["shops", "users", "products", "sales", "saleItems", "customers", "expenses", "payments", "stockMovements", "smsLogs", "backupLogs"],
    },
    shops, users, products, sales, saleItems, customers,
    expenses, payments, stockMovements, smsLogs, backupLogs,
  };
}

// ── Send backup email ────────────────────────────────────────────────────────

async function sendBackupEmail(fileName: string, content: string, type: BackupType): Promise<void> {
  const to = process.env.BACKUP_EMAIL || process.env.SMTP_USER!;
  const from = `"StoreMate Backup" <${process.env.SMTP_USER}>`;
  const fileSize = Buffer.byteLength(content, "utf8");
  const sizeFmt = fileSize < 1024 * 1024
    ? `${(fileSize / 1024).toFixed(1)} KB`
    : `${(fileSize / 1024 / 1024).toFixed(2)} MB`;

  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const date = new Date().toLocaleString("en-LK", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo",
  });

  const transporter = getTransporter();
  await transporter.sendMail({
    from,
    to,
    subject: `[StoreMate Backup] ${typeLabel} — ${new Date().toISOString().slice(0, 10)}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
        <div style="margin-bottom:20px">
          <span style="display:inline-block;background:#2DA86B;color:#fff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;letter-spacing:0.5px">
            ${typeLabel} Backup
          </span>
        </div>
        <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 8px">StoreMate Database Backup</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 20px">Your ${type} backup completed successfully on <strong>${date} (Sri Lanka Time)</strong>.</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;background:#f9fafb;border-radius:8px;overflow:hidden">
          <tr><td style="padding:10px 14px;color:#6b7280;border-bottom:1px solid #e5e7eb">File</td><td style="padding:10px 14px;font-family:monospace;color:#111827;border-bottom:1px solid #e5e7eb">${fileName}</td></tr>
          <tr><td style="padding:10px 14px;color:#6b7280;border-bottom:1px solid #e5e7eb">Size</td><td style="padding:10px 14px;font-family:monospace;color:#111827;border-bottom:1px solid #e5e7eb">${sizeFmt}</td></tr>
          <tr><td style="padding:10px 14px;color:#6b7280">Type</td><td style="padding:10px 14px;color:#111827">${typeLabel}</td></tr>
        </table>
        <p style="color:#9ca3af;font-size:12px;margin:20px 0 0">The full database export is attached as a JSON file. Store it safely — it contains all shop data, products, sales, and customer records.</p>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f3f4f6">
          <p style="color:#d1d5db;font-size:11px;margin:0">Sent by StoreMate · Smart Shop Manager</p>
        </div>
      </div>`,
    attachments: [
      {
        filename: fileName,
        content: Buffer.from(content, "utf8"),
        contentType: "application/json",
      },
    ],
  });
}

// ── Main backup function ─────────────────────────────────────────────────────

export async function runBackup(type: BackupType): Promise<{
  success: boolean;
  fileName?: string;
  fileSize?: number;
  error?: string;
}> {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `storemate-backup-${type}-${timestamp}.json`;

  try {
    const data = await exportAllData();
    const json = JSON.stringify(data, null, 2);
    const fileSize = Buffer.byteLength(json, "utf8");

    await sendBackupEmail(fileName, json, type);

    await db.backupLog.create({
      data: { type, status: "success", fileName, fileSize },
    });

    console.log(`[Backup] ${type} backup emailed: ${fileName} (${(fileSize / 1024).toFixed(1)} KB)`);
    return { success: true, fileName, fileSize };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Backup] ${type} backup failed:`, error);

    await db.backupLog.create({
      data: { type, status: "failed", error },
    });

    return { success: false, error };
  }
}
