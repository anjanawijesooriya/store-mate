"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Database, Download, CheckCircle, XCircle, Loader2, RefreshCcw, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BackupLog {
  id: string;
  type: string;
  status: string;
  fileId: string | null;
  fileName: string | null;
  fileSize: number | null;
  driveUrl: string | null;
  error: string | null;
  createdAt: Date | string;
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleString("en-LK", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const TYPE_BADGE: Record<string, string> = {
  daily:  "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  weekly: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20",
  manual: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
};

export function BackupClient({ logs: initial, configError: initialConfigError }: { logs: BackupLog[]; configError: string | null }) {
  const [logs, setLogs] = useState<BackupLog[]>(initial);
  const [running, setRunning] = useState(false);
  const [configError, setConfigError] = useState<string | null>(initialConfigError);

  async function triggerBackup() {
    setRunning(true);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "manual" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error ?? "Backup failed");
      } else {
        toast.success(`Backup saved to Google Drive — ${data.fileName}`);
        await refresh();
      }
    } catch {
      toast.error("Backup request failed");
    } finally {
      setRunning(false);
    }
  }

  async function refresh() {
    const res = await fetch("/api/admin/backup");
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setConfigError(data.configError ?? null);
    }
  }

  const lastSuccess = logs.find((l) => l.status === "success");
  const configured = true; // server will return error if not configured

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Database Backups</h1>
        <p className="text-sm text-muted-foreground mt-1">Full database exported as JSON and emailed as an attachment</p>
      </div>

      {configError && (
        <div className="flex gap-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Email not configured</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">{configError}</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">After fixing .env.local, restart the dev server for changes to take effect.</p>
          </div>
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Backups</p>
            <p className="text-3xl font-bold mt-2 tabular-nums">{logs.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Successful</p>
            <p className="text-sm font-semibold mt-2 text-foreground">
              {lastSuccess ? fmtDate(lastSuccess.createdAt) : "No backups yet"}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Schedule</p>
            <p className="text-sm font-semibold mt-2 text-foreground">Daily + Weekly</p>
            <p className="text-xs text-muted-foreground mt-0.5">via GitHub Actions</p>
          </CardContent>
        </Card>
      </div>

      {/* Manual trigger */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Manual Backup
          </CardTitle>
          <CardDescription>
            Export the full database now and send it as a JSON attachment to your backup email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={triggerBackup} disabled={running} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {running ? "Running backup…" : "Run Backup Now"}
          </Button>
        </CardContent>
      </Card>

      {/* Schedule info */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Automated Schedule
          </CardTitle>
          <CardDescription>Backups are triggered by GitHub Actions on a schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
            <div>
              <p className="font-medium text-foreground">Daily Backup</p>
              <p className="text-xs text-muted-foreground">Every day at 2:00 AM UTC</p>
            </div>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_BADGE.daily}`}>
              Daily
            </span>
          </div>
          <div className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
            <div>
              <p className="font-medium text-foreground">Weekly Backup</p>
              <p className="text-xs text-muted-foreground">Every Sunday at 3:00 AM UTC</p>
            </div>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_BADGE.weekly}`}>
              Weekly
            </span>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Set up: add <code className="bg-muted px-1 py-0.5 rounded text-xs">APP_URL</code> and{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">BACKUP_CRON_SECRET</code> as GitHub repository secrets.
          </p>
        </CardContent>
      </Card>

      {/* Backup history */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="pb-0 px-6 pt-5 border-b border-border flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Backup History</CardTitle>
          <Button variant="ghost" size="sm" onClick={refresh} className="gap-1.5 text-xs h-8">
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                {["Date", "Type", "Status", "File", "Size"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No backups yet. Run your first backup above.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_BADGE[log.type] ?? TYPE_BADGE.manual}`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.status === "success" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                          <CheckCircle className="h-3.5 w-3.5" /> Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium" title={log.error ?? ""}>
                          <XCircle className="h-3.5 w-3.5" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate" title={log.fileName ?? ""}>
                      {log.fileName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {fmtSize(log.fileSize)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
