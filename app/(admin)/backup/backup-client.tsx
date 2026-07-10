"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  Database, Download, CheckCircle, XCircle, Loader2, RefreshCcw,
  Clock, AlertTriangle, Upload, ShieldAlert, FileJson, HardDrive, Mail, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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

interface BackupMeta {
  exportedAt: string;
  version: string;
  tables: string[];
}

interface RestorePreview {
  meta: BackupMeta;
  counts: Record<string, number>;
  raw: object;
  fileName: string;
  fileSizeKB: number;
}

interface RestoreResult {
  counts: Record<string, number>;
  totalRestored: number;
  errors: string[];
}

export function BackupClient({
  logs: initial,
  configError: initialConfigError,
  driveConfigured: initialDrive,
  emailConfigured: initialEmail,
}: {
  logs: BackupLog[];
  configError: string | null;
  driveConfigured: boolean;
  emailConfigured: boolean;
}) {
  const [logs, setLogs] = useState<BackupLog[]>(initial);
  const [running, setRunning] = useState(false);
  const [configError, setConfigError] = useState<string | null>(initialConfigError);
  const [driveConfigured, setDriveConfigured] = useState(initialDrive);
  const [emailConfigured, setEmailConfigured] = useState(initialEmail);

  // Restore state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);

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
      setDriveConfigured(data.driveConfigured ?? false);
      setEmailConfigured(data.emailConfigured ?? false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      toast.error("Please select a .json backup file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        if (!raw._meta) {
          toast.error("Invalid backup file — missing _meta header");
          return;
        }
        const counts: Record<string, number> = {};
        const tableKeys = ["shopGroups", "shops", "users", "products", "sales", "saleItems",
          "customers", "expenses", "payments", "maintenancePayments", "stockMovements", "smsLogs"];
        for (const key of tableKeys) {
          if (Array.isArray(raw[key])) counts[key] = raw[key].length;
        }
        setRestorePreview({
          meta: raw._meta,
          counts,
          raw,
          fileName: file.name,
          fileSizeKB: Math.round(file.size / 1024),
        });
        setRestoreConfirmText("");
        setRestoreResult(null);
        setRestoreDialogOpen(true);
      } catch {
        toast.error("Could not parse backup file — make sure it is a valid eStoreMate JSON backup");
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-selected if needed
    e.target.value = "";
  }

  async function handleRestore() {
    if (!restorePreview || restoreConfirmText !== "RESTORE") return;
    setRestoring(true);
    try {
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restorePreview.raw),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Restore failed");
        return;
      }
      setRestoreResult({ counts: data.counts, totalRestored: data.totalRestored, errors: data.errors });
      toast.success(`Restore complete — ${data.totalRestored} records restored`);
      await refresh();
    } catch {
      toast.error("Restore request failed");
    } finally {
      setRestoring(false);
    }
  }

  const backupLogs  = logs.filter((l) => l.type !== "restore");
  const restoreLogs = logs.filter((l) => l.type === "restore");
  const lastSuccess = backupLogs.find((l) => l.status === "success");
  const configured = true; // server will return error if not configured

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Database Backups</h1>
        <p className="text-sm text-muted-foreground mt-1">Full database backed up to Google Drive (gzip) with email notification</p>
      </div>

      {/* Destination status */}
      <div className="flex flex-wrap gap-3">
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${driveConfigured ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "border-border bg-muted/40 text-muted-foreground"}`}>
          <HardDrive className="h-4 w-4" />
          Google Drive {driveConfigured ? "✓ Configured" : "Not configured"}
        </div>
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${emailConfigured ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400" : "border-border bg-muted/40 text-muted-foreground"}`}>
          <Mail className="h-4 w-4" />
          Email {emailConfigured ? (driveConfigured ? "✓ Notification only" : "✓ Attachment fallback") : "Not configured"}
        </div>
      </div>

      {configError && (
        <div className="flex gap-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">No backup destination configured</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">{configError}</p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">After updating .env.local, restart the server for changes to take effect.</p>
          </div>
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Backups</p>
            <p className="text-3xl font-bold mt-2 tabular-nums">{backupLogs.length}</p>
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
            {driveConfigured
              ? "Export the full database now, upload to Google Drive (gzip-compressed), and send an email notification."
              : "Export the full database now and send it as a JSON attachment to your backup email."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={triggerBackup} disabled={running} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {running ? "Running backup…" : "Run Backup Now"}
          </Button>
        </CardContent>
      </Card>

      {/* Restore from backup */}
      <Card className="shadow-sm border-amber-200 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Upload className="h-4 w-4" />
            Restore from Backup
          </CardTitle>
          <CardDescription>
            Upload a eStoreMate JSON backup file to restore data. Existing records are updated (upsert) — nothing is deleted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
            <ShieldAlert className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>This operation overwrites matching records. Data not present in the backup file is left untouched. Take a fresh backup before restoring.</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            className="gap-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileJson className="h-4 w-4" />
            Choose Backup File…
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
                {["Date", "Type", "Status", "File", "Size", "Drive"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {backupLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No backups yet. Run your first backup above.
                  </td>
                </tr>
              ) : (
                backupLogs.map((log) => (
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
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate font-mono" title={log.fileName ?? ""}>{log.fileName ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{fmtSize(log.fileSize)}</td>
                    <td className="px-4 py-3">
                      {log.driveUrl ? (
                        <a
                          href={log.driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          <ExternalLink className="h-3 w-3" /> Open
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Restore history */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="pb-0 px-6 pt-5 border-b border-border flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Upload className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Restore History
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                {["Date", "Status", "Source Backup", "Errors"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {restoreLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No restores performed yet.
                  </td>
                </tr>
              ) : (
                restoreLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      {log.status === "success" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                          <CheckCircle className="h-3.5 w-3.5" /> Success
                        </span>
                      ) : log.status === "partial" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" /> Partial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
                          <XCircle className="h-3.5 w-3.5" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[240px] truncate font-mono" title={log.fileName ?? ""}>
                      {log.fileName?.replace("restore-", "") ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate" title={log.error ?? ""}>
                      {log.error ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {/* ── Restore confirmation dialog ── */}
      <Dialog open={restoreDialogOpen} onOpenChange={(o) => { if (!o && !restoring) { setRestoreDialogOpen(false); setRestorePreview(null); setRestoreResult(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Upload className="h-5 w-5" />
              Restore Database from Backup
            </DialogTitle>
          </DialogHeader>

          {restoreResult ? (
            /* ── Result view ── */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold text-sm">
                <CheckCircle className="h-5 w-5" />
                Restore complete — {restoreResult.totalRestored} records restored
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Table</th>
                      <th className="text-right px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wide">Restored</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(restoreResult.counts).map(([table, count]) => (
                      <tr key={table} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-foreground font-mono">{table}</td>
                        <td className="px-3 py-2 text-right font-semibold text-foreground tabular-nums">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {restoreResult.errors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 space-y-1">
                  <p className="text-xs font-semibold text-destructive">{restoreResult.errors.length} error{restoreResult.errors.length !== 1 ? "s" : ""} during restore:</p>
                  {restoreResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-destructive/80 font-mono">{e}</p>
                  ))}
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => { setRestoreDialogOpen(false); setRestoreResult(null); setRestorePreview(null); }}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : restorePreview ? (
            /* ── Preview + confirm view ── */
            <div className="space-y-4">
              {/* File info */}
              <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileJson className="h-4 w-4 text-primary" />
                  {restorePreview.fileName}
                </div>
                <p className="text-xs text-muted-foreground">
                  Exported {new Date(restorePreview.meta.exportedAt).toLocaleString("en-LK", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}{restorePreview.fileSizeKB} KB{" · "}v{restorePreview.meta.version}
                </p>
              </div>

              {/* Record counts */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Records in backup</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(restorePreview.counts).map(([table, count]) => (
                    <div key={table} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5">
                      <span className="text-xs text-muted-foreground font-mono">{table}</span>
                      <span className="text-xs font-bold tabular-nums text-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                <ShieldAlert className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>All matching records will be <strong>overwritten</strong> with backup data. Records not in the backup are left unchanged. This cannot be undone.</span>
              </div>

              {/* Confirmation */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Type <span className="font-mono font-bold text-amber-600 dark:text-amber-400">RESTORE</span> to confirm
                </Label>
                <Input
                  value={restoreConfirmText}
                  onChange={(e) => setRestoreConfirmText(e.target.value)}
                  placeholder="RESTORE"
                  className="h-10 font-mono"
                  disabled={restoring}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setRestoreDialogOpen(false); setRestorePreview(null); }} disabled={restoring}>
                  Cancel
                </Button>
                <Button
                  disabled={restoreConfirmText !== "RESTORE" || restoring}
                  onClick={handleRestore}
                  className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {restoring ? "Restoring…" : "Restore Database"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
