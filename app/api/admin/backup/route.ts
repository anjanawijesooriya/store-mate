import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";
import { runBackup, BackupType } from "@/lib/backup";

// Secret key for external cron callers (GitHub Actions, cron-job.org, etc.)
function isCronAuthorized(req: NextRequest) {
  const secret = process.env.BACKUP_CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("x-backup-secret") === secret;
}

function checkConfig() {
  if (!process.env.SMTP_USER) return "SMTP_USER is not set in .env.local — needed to send backup emails.";
  if (!process.env.SMTP_PASS) return "SMTP_PASS is not set in .env.local — needed to send backup emails.";
  return null;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin()) && !isCronAuthorized(req)) {
    return apiError("Unauthorized", 401);
  }

  const configError = checkConfig();
  const logs = await db.backupLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Response.json({ logs, configError });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin()) && !isCronAuthorized(req)) {
    return apiError("Unauthorized", 401);
  }

  const configError = checkConfig();
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
