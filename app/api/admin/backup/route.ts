import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";
import { runBackup, BackupType } from "@/lib/backup";
import { isDriveConfigured } from "@/lib/google-drive";

// Secret key for external cron callers (GitHub Actions, cron-job.org, etc.)
function isCronAuthorized(req: NextRequest) {
  const secret = process.env.BACKUP_CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("x-backup-secret") === secret;
}

function checkConfig(): { error: string | null; driveConfigured: boolean; emailConfigured: boolean } {
  const driveConfigured = isDriveConfigured();
  const emailConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  if (!driveConfigured && !emailConfigured) {
    return {
      error: "No backup destination configured. Set up Google Drive credentials (recommended) or SMTP credentials in .env.local.",
      driveConfigured,
      emailConfigured,
    };
  }
  return { error: null, driveConfigured, emailConfigured };
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin()) && !isCronAuthorized(req)) {
    return apiError("Unauthorized", 401);
  }

  const { error: configError, driveConfigured, emailConfigured } = checkConfig();
  const logs = await db.backupLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Response.json({ logs, configError, driveConfigured, emailConfigured });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin()) && !isCronAuthorized(req)) {
    return apiError("Unauthorized", 401);
  }

  const { error: configError } = checkConfig();
  if (configError) {
    return Response.json({ success: false, error: configError }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const type: BackupType = ["daily", "weekly", "manual"].includes(body.type)
    ? body.type
    : "manual";

  const result = await runBackup(type);
  return Response.json(result, { status: result.success ? 200 : 500 });
}
