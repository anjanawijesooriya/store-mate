import { Metadata } from "next";
import { db } from "@/lib/db";
import { BackupClient } from "./backup-client";

export const metadata: Metadata = { title: "Admin — Backups" };

export default async function BackupPage() {
  const logs = await db.backupLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return <BackupClient logs={logs} />;
}
