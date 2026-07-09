import { Metadata } from "next";
import { db } from "@/lib/db";
import { isDriveConfigured } from "@/lib/google-drive";
import { BackupClient } from "./backup-client";

export const metadata: Metadata = { title: "Admin — Backups" };

export default async function BackupPage() {
  const logs = await db.backupLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const driveConfigured = isDriveConfigured();
  const emailConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  const configError = !driveConfigured && !emailConfigured
    ? "No backup destination configured. Set up Google Drive credentials (recommended) or SMTP credentials in .env.local."
    : null;

  return (
    <BackupClient
      logs={logs}
      configError={configError}
      driveConfigured={driveConfigured}
      emailConfigured={emailConfigured}
    />
  );
}
