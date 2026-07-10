import { db } from "@/lib/db";
import nodemailer from "nodemailer";
import { isDriveConfigured, uploadToDrive } from "@/lib/google-drive";

export type BackupType = "daily" | "weekly" | "manual";

// ── Mailer ───────────────────────────────────────────────────────────────────

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function isEmailConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

// ── Data export ──────────────────────────────────────────────────────────────

async function exportAllData() {
  const [
    shopGroups, shops, users, products, sales, saleItems, customers,
    expenses, payments, maintenancePayments, stockMovements, smsLogs, backupLogs,
  ] = await Promise.all([
    db.shopGroup.findMany(),
    db.shop.findMany(),
    db.user.findMany({ select: { id: true, shopId: true, name: true, phone: true, email: true, passwordHash: true, role: true, createdAt: true } }),
    db.product.findMany(),
    db.sale.findMany(),
    db.saleItem.findMany(),
    db.customer.findMany(),
    db.expense.findMany(),
    db.payment.findMany(),
    db.maintenancePayment.findMany(),
    db.stockMovement.findMany(),
    db.smsLog.findMany({ orderBy: { createdAt: "desc" }, take: 1000 }),
    db.backupLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return {
    _meta: {
      exportedAt: new Date().toISOString(),
      version: "2.0",
      tables: ["shopGroups", "shops", "users", "products", "sales", "saleItems",
        "customers", "expenses", "payments", "maintenancePayments", "stockMovements", "smsLogs", "backupLogs"],
    },
    shopGroups, shops, users, products, sales, saleItems, customers,
    expenses, payments, maintenancePayments, stockMovements, smsLogs, backupLogs,
  };
}

// ── Email: Drive notification (no attachment) ────────────────────────────────

async function sendDriveNotificationEmail(
  fileName: string,
  driveUrl: string,
  originalSize: number,
  compressedSize: number,
  type: BackupType,
): Promise<void> {
  if (!isEmailConfigured()) return;

  const to = process.env.BACKUP_EMAIL || process.env.SMTP_USER!;
  const from = `"eStoreMate Backup" <${process.env.SMTP_USER}>`;
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const date = new Date().toLocaleString("en-LK", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo",
  });
  const origFmt = originalSize < 1024 * 1024
    ? `${(originalSize / 1024).toFixed(1)} KB`
    : `${(originalSize / 1024 / 1024).toFixed(2)} MB`;
  const compFmt = compressedSize < 1024 * 1024
    ? `${(compressedSize / 1024).toFixed(1)} KB`
    : `${(compressedSize / 1024 / 1024).toFixed(2)} MB`;

  const transporter = getTransporter();
  await transporter.sendMail({
    from, to,
    subject: `[eStoreMate Backup] ${typeLabel} ✅ — ${new Date().toISOString().slice(0, 10)}`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
        <div style="margin-bottom:20px">
          <span style="display:inline-block;background:#2DA86B;color:#fff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;letter-spacing:0.5px">
            ${typeLabel} Backup ✅
          </span>
        </div>
        <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 8px">eStoreMate Database Backup</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 20px">
          Your ${type} backup completed successfully on <strong>${date} (Sri Lanka Time)</strong> and was saved to Google Drive.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;background:#f9fafb;border-radius:8px;overflow:hidden">
          <tr><td style="padding:10px 14px;color:#6b7280;border-bottom:1px solid #e5e7eb">File</td><td style="padding:10px 14px;font-family:monospace;color:#111827;border-bottom:1px solid #e5e7eb">${fileName}.gz</td></tr>
          <tr><td style="padding:10px 14px;color:#6b7280;border-bottom:1px solid #e5e7eb">Original size</td><td style="padding:10px 14px;font-family:monospace;color:#111827;border-bottom:1px solid #e5e7eb">${origFmt}</td></tr>
          <tr><td style="padding:10px 14px;color:#6b7280;border-bottom:1px solid #e5e7eb">Compressed size</td><td style="padding:10px 14px;font-family:monospace;color:#2DA86B;border-bottom:1px solid #e5e7eb">${compFmt}</td></tr>
          <tr><td style="padding:10px 14px;color:#6b7280">Type</td><td style="padding:10px 14px;color:#111827">${typeLabel}</td></tr>
        </table>
        <div style="margin-top:20px">
          <a href="${driveUrl}" style="display:inline-block;background:#2DA86B;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">
            View in Google Drive →
          </a>
        </div>
        <p style="color:#9ca3af;font-size:12px;margin:20px 0 0">
          The backup is stored as a gzip-compressed JSON file in your Google Drive backup folder.
          Download and decompress it to restore.
        </p>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f3f4f6">
          <p style="color:#d1d5db;font-size:11px;margin:0">Sent by eStoreMate · Smart Shop Manager</p>
        </div>
      </div>`,
  });
}

// ── Email: attachment fallback (no Drive) ────────────────────────────────────

async function sendBackupEmailAttachment(fileName: string, content: string, type: BackupType): Promise<void> {
  const to = process.env.BACKUP_EMAIL || process.env.SMTP_USER!;
  const from = `"eStoreMate Backup" <${process.env.SMTP_USER}>`;
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
    from, to,
    subject: `[eStoreMate Backup] ${typeLabel} — ${new Date().toISOString().slice(0, 10)}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
        <div style="margin-bottom:20px">
          <span style="display:inline-block;background:#2DA86B;color:#fff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;letter-spacing:0.5px">
            ${typeLabel} Backup
          </span>
        </div>
        <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 8px">eStoreMate Database Backup</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 20px">Your ${type} backup completed on <strong>${date} (Sri Lanka Time)</strong>.</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;background:#f9fafb;border-radius:8px;overflow:hidden">
          <tr><td style="padding:10px 14px;color:#6b7280;border-bottom:1px solid #e5e7eb">File</td><td style="padding:10px 14px;font-family:monospace;color:#111827;border-bottom:1px solid #e5e7eb">${fileName}</td></tr>
          <tr><td style="padding:10px 14px;color:#6b7280;border-bottom:1px solid #e5e7eb">Size</td><td style="padding:10px 14px;font-family:monospace;color:#111827;border-bottom:1px solid #e5e7eb">${sizeFmt}</td></tr>
          <tr><td style="padding:10px 14px;color:#6b7280">Type</td><td style="padding:10px 14px;color:#111827">${typeLabel}</td></tr>
        </table>
        <p style="color:#9ca3af;font-size:12px;margin:20px 0 0">The full database export is attached. Store it safely.</p>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f3f4f6">
          <p style="color:#d1d5db;font-size:11px;margin:0">Sent by eStoreMate · Smart Shop Manager</p>
        </div>
      </div>`,
    attachments: [{ filename: fileName, content: Buffer.from(content, "utf8"), contentType: "application/json" }],
  });
}

// ── Email: failure alert ─────────────────────────────────────────────────────

async function sendFailureEmail(type: BackupType, error: string): Promise<void> {
  if (!isEmailConfigured()) return;
  const to = process.env.BACKUP_EMAIL || process.env.SMTP_USER!;
  const from = `"eStoreMate Backup" <${process.env.SMTP_USER}>`;
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const transporter = getTransporter();
  await transporter.sendMail({
    from, to,
    subject: `[eStoreMate Backup] ❌ ${typeLabel} Backup Failed — ${new Date().toISOString().slice(0, 10)}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #fecaca">
        <h2 style="color:#dc2626;margin:0 0 12px">Backup Failed ❌</h2>
        <p style="color:#6b7280;font-size:14px;margin:0 0 16px">The ${type} backup for eStoreMate failed.</p>
        <pre style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:6px;font-size:12px;color:#dc2626;white-space:pre-wrap;word-break:break-all">${error}</pre>
        <p style="color:#d1d5db;font-size:11px;margin:20px 0 0">eStoreMate · Smart Shop Manager</p>
      </div>`,
  });
}

// ── Main backup function ─────────────────────────────────────────────────────

export async function runBackup(type: BackupType): Promise<{
  success: boolean;
  fileName?: string;
  fileSize?: number;
  driveUrl?: string;
  error?: string;
}> {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `estoremate-backup-${type}-${timestamp}.json`;

  try {
    const data = await exportAllData();
    const json = JSON.stringify(data, null, 2);
    const fileSize = Buffer.byteLength(json, "utf8");

    if (isDriveConfigured()) {
      // ── Google Drive path ────────────────────────────────────────────────
      const subfolder = type === "daily" ? "daily" : type === "weekly" ? "weekly" : "manual";
      const { fileId, driveUrl, compressedSize } = await uploadToDrive(fileName, json, subfolder);

      await db.backupLog.create({
        data: { type, status: "success", fileName: `${fileName}.gz`, fileSize: compressedSize, fileId, driveUrl },
      });

      // Send notification email with Drive link (no attachment)
      await sendDriveNotificationEmail(fileName, driveUrl, fileSize, compressedSize, type).catch((e) => {
        console.warn("[Backup] Notification email failed (non-fatal):", e.message);
      });

      console.log(`[Backup] ${type} → Drive: ${fileName}.gz (${(compressedSize / 1024).toFixed(1)} KB compressed)`);
      return { success: true, fileName: `${fileName}.gz`, fileSize: compressedSize, driveUrl };

    } else if (isEmailConfigured()) {
      // ── Email attachment fallback ────────────────────────────────────────
      await sendBackupEmailAttachment(fileName, json, type);

      await db.backupLog.create({
        data: { type, status: "success", fileName, fileSize },
      });

      console.log(`[Backup] ${type} → Email attachment: ${fileName} (${(fileSize / 1024).toFixed(1)} KB)`);
      return { success: true, fileName, fileSize };

    } else {
      throw new Error("No backup destination configured — set Google Drive credentials or SMTP credentials in .env.local");
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Backup] ${type} backup failed:`, error);

    await db.backupLog.create({
      data: { type, status: "failed", error },
    }).catch(() => {});

    await sendFailureEmail(type, error).catch(() => {});

    return { success: false, error };
  }
}
