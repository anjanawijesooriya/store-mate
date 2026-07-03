"use client";

import { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import { Store, Bell, CreditCard, Loader2, MessageSquare, CheckCircle, Clock, AlertTriangle, Lock, Monitor, Trash2, ShieldCheck, KeyRound } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/shop-categories";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type BillingStatus = "TRIAL" | "ACTIVE" | "GRACE" | "LOCKED";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  planTier: string;
  billingMonth: string;
  note: string | null;
  paidAt: Date;
}

interface Shop {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  email: string | null;
  category: string;
  address: string | null;
  planTier: string;
  trialEndsAt: Date | null;
  smsAddonEnabled: boolean;
  smsLowStock: boolean;
  smsDailySummary: boolean;
  smsReceiptEnabled: boolean;
  smsCredits: number;
  emailLowStock: boolean;
  emailDailySummary: boolean;
  emailReceiptEnabled: boolean;
  billingStatus: BillingStatus;
  gracePeriodEndsAt: Date | null;
  nextBillingDate: Date | null;
  payments: Payment[];
}

function fmtDate(d: Date | null | string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-LK", { year: "numeric", month: "long", day: "numeric" });
}

const BILLING_STATUS_CONFIG: Record<BillingStatus, { label: string; icon: React.ElementType; color: string }> = {
  TRIAL: { label: "Free Trial", icon: Clock, color: "text-blue-600" },
  ACTIVE: { label: "Active", icon: CheckCircle, color: "text-green-600" },
  GRACE: { label: "Grace Period", icon: AlertTriangle, color: "text-amber-600" },
  LOCKED: { label: "Locked", icon: Lock, color: "text-red-600" },
};

const PLAN_LABELS: Record<string, { label: string; price: string }> = {
  BASIC: { label: "Basic", price: "LKR 5,000/mo" },
  STANDARD: { label: "Standard", price: "LKR 8,000/mo" },
  PREMIUM: { label: "Premium", price: "LKR 13,000/mo" },
};

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-input"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

interface DeviceInfo {
  id: string;
  deviceId: string;
  deviceName: string;
  lastSeenAt: string;
  createdAt: string;
  isCurrent: boolean;
}

const DEVICE_LIMITS: Record<string, number> = {
  BASIC: 1, STANDARD: 3, PREMIUM: Infinity,
};

export function SettingsClient({ shop }: { shop: Shop }) {
  const { update: updateSession } = useSession();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: shop.name,
    ownerName: shop.ownerName,
    email: shop.email ?? "",
    address: shop.address ?? "",
  });

  const [smsPrefs, setSmsPrefs] = useState({
    smsLowStock: shop.smsLowStock,
    smsDailySummary: shop.smsDailySummary,
    smsReceiptEnabled: shop.smsReceiptEnabled,
  });
  const [smsSaving, setSmsSaving] = useState(false);

  const [emailPrefs, setEmailPrefs] = useState({
    emailLowStock:       shop.emailLowStock,
    emailDailySummary:   shop.emailDailySummary,
    emailReceiptEnabled: shop.emailReceiptEnabled,
  });
  const [emailSaving, setEmailSaving] = useState(false);

  async function handleEmailToggle(key: keyof typeof emailPrefs, value: boolean) {
    const prev = emailPrefs[key];
    setEmailPrefs((p) => ({ ...p, [key]: value }));
    setEmailSaving(true);
    try {
      const res = await fetch("/api/email/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        setEmailPrefs((p) => ({ ...p, [key]: prev }));
        toast.error("Failed to update email preference");
      } else {
        toast.success("Email preference updated");
      }
    } catch {
      setEmailPrefs((p) => ({ ...p, [key]: prev }));
      toast.error("Failed to update email preference");
    } finally {
      setEmailSaving(false);
    }
  }

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { toast.error("Passwords do not match"); return; }
    if (pwForm.next.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to change password"); return; }
      toast.success("Password changed successfully");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch {
      toast.error("Failed to change password");
    } finally {
      setPwSaving(false);
    }
  }

  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/devices")
      .then((r) => r.ok ? r.json() : { devices: [] })
      .then((d) => setDevices(d.devices ?? []))
      .catch(() => {})
      .finally(() => setDevicesLoading(false));
  }, []);

  async function removeDevice(id: string) {
    setRemovingId(id);
    try {
      const res = await fetch(`/api/devices?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to remove device"); return; }
      setDevices((prev) => prev.filter((d) => d.id !== id));
      toast.success("Device removed — they will be signed out on next action");
    } catch {
      toast.error("Failed to remove device");
    } finally {
      setRemovingId(null);
    }
  }

  const plan = PLAN_LABELS[shop.planTier] ?? PLAN_LABELS.BASIC;
  function calendarDaysLeft(date: Date | string | null): number | null {
    if (!date) return null;
    const end = new Date(date);
    end.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((end.getTime() - today.getTime()) / 86_400_000));
  }

  const trialDaysLeft = calendarDaysLeft(shop.trialEndsAt);
  const graceDaysLeft = calendarDaysLeft(shop.gracePeriodEndsAt);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/shop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, ownerName: form.ownerName, email: form.email, address: form.address }),
      });
      if (!res.ok) { toast.error("Failed to save settings"); return; }
      // Update topbar instantly via event, then sync JWT in background
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: { name: form.ownerName, shopName: form.name } }));
      updateSession({ name: form.ownerName, shopName: form.name });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleSmsToggle(key: keyof typeof smsPrefs, value: boolean) {
    const prev = smsPrefs[key];
    setSmsPrefs((p) => ({ ...p, [key]: value }));
    setSmsSaving(true);
    try {
      const res = await fetch("/api/sms/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        setSmsPrefs((p) => ({ ...p, [key]: prev }));
        toast.error("Failed to update SMS preference");
        return;
      }
      toast.success("SMS preference updated");
    } catch {
      setSmsPrefs((p) => ({ ...p, [key]: prev }));
      toast.error("Failed to update SMS preference");
    } finally {
      setSmsSaving(false);
    }
  }

  const SMS_OPTIONS = [
    {
      key: "smsLowStock" as const,
      label: "Low Stock Alert",
      desc: "Daily morning alert when products are running low",
    },
    {
      key: "smsDailySummary" as const,
      label: "Daily Sales Summary",
      desc: "Receive a summary at 9 PM with today's sales total",
    },
    {
      key: "smsReceiptEnabled" as const,
      label: "Customer Receipt SMS",
      desc: "Send receipts via SMS to customers after each sale",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your shop and account settings" />

      {shop.billingStatus === "TRIAL" && trialDaysLeft !== null && (
        <div className={`rounded-lg border px-4 py-3 flex items-center justify-between ${
          trialDaysLeft <= 7
            ? "border-[color:var(--brand-warning)]/30 bg-[color:var(--brand-warning)]/10"
            : "border-[color:var(--brand-success)]/30 bg-[color:var(--brand-success)]/10"
        }`}>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {trialDaysLeft > 0 ? `Free Trial — ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} remaining` : "Trial Ended"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {trialDaysLeft > 0
                ? "Contact admin to upgrade your plan before the trial ends."
                : "Your free trial has ended. Contact admin to continue using StoreMate."}
            </p>
          </div>
          <a
            href={`https://wa.me/${(process.env.NEXT_PUBLIC_ADMIN_PHONE ?? "").replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 ml-4"
          >
            <Button size="sm" className="font-semibold">Contact Admin</Button>
          </a>
        </div>
      )}

      {shop.billingStatus === "GRACE" && graceDaysLeft !== null && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {graceDaysLeft > 0
                ? `Grace Period — ${graceDaysLeft} day${graceDaysLeft !== 1 ? "s" : ""} remaining`
                : "Grace Period Ended"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {graceDaysLeft > 0
                ? "Payment overdue — contact admin immediately to avoid being locked out."
                : "Your grace period has ended. Contact admin to restore access."}
            </p>
          </div>
          <a
            href={`https://wa.me/${(process.env.NEXT_PUBLIC_ADMIN_PHONE ?? "").replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 ml-4"
          >
            <Button size="sm" variant="outline" className="font-semibold border-amber-500 text-amber-700 hover:bg-amber-50">
              Contact Admin
            </Button>
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* ── LEFT COLUMN ── */}
      <div className="space-y-6">

      {/* Shop information */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4" />
            Shop Information
          </CardTitle>
          <CardDescription>Update your shop name and details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sname">Shop Name</Label>
              <Input
                id="sname"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sownerName">Owner Name</Label>
              <Input
                id="sownerName"
                value={form.ownerName}
                onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="semail">Email Address</Label>
              <Input
                id="semail"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">Used for password reset notifications</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="saddress">Address</Label>
              <Input
                id="saddress"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Phone Number</Label>
                <p className="text-sm font-mono font-medium">{shop.phone}</p>
                <p className="text-xs text-muted-foreground">Cannot be changed</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Shop Category</Label>
                <p className="text-sm font-medium">{CATEGORY_LABELS[shop.category] ?? shop.category}</p>
              </div>
            </div>
            <Separator />
            <Button type="submit" disabled={saving} className="font-semibold">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* SMS Notifications */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            SMS Notifications
          </CardTitle>
          <CardDescription>
            {shop.smsAddonEnabled
              ? <>Configure which alerts are sent to your phone · <span className="font-medium">{shop.smsCredits} credit{shop.smsCredits !== 1 ? "s" : ""} remaining</span></>
              : "Send SMS alerts and receipts to customers"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {shop.smsAddonEnabled ? (
            <>
              {SMS_OPTIONS.map((item) => (
                <div key={item.key} className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <Toggle
                    checked={smsPrefs[item.key]}
                    onChange={(v) => handleSmsToggle(item.key, v)}
                    disabled={smsSaving}
                  />
                </div>
              ))}
              {shop.smsCredits === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
                  No SMS credits remaining — contact admin to top up.
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center text-center py-6 gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">SMS add-on not activated</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Contact your StoreMate admin to enable the SMS add-on for your shop. Once activated you can send low-stock alerts, daily summaries, and customer receipts.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Email alerts sent to your registered email address — on by default, free to use
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {[
            { key: "emailLowStock"       as const, label: "Low Stock Alert",      desc: "Daily morning alert when products are running low" },
            { key: "emailDailySummary"   as const, label: "Daily Sales Summary",  desc: "Receive a summary at 9 PM with today's sales total" },
            { key: "emailReceiptEnabled" as const, label: "Customer Receipt Email", desc: "Send receipts via email to customers after each sale" },
          ].map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Bell className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
              <Toggle
                checked={emailPrefs[item.key]}
                onChange={(v) => handleEmailToggle(item.key, v)}
                disabled={emailSaving}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Change Password
          </CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cpw-current">Current Password</Label>
              <Input
                id="cpw-current"
                type="password"
                placeholder="Enter current password"
                value={pwForm.current}
                onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpw-next">New Password</Label>
              <Input
                id="cpw-next"
                type="password"
                placeholder="Min. 8 characters"
                value={pwForm.next}
                onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpw-confirm">Confirm New Password</Label>
              <Input
                id="cpw-confirm"
                type="password"
                placeholder="Repeat new password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                required
                autoComplete="new-password"
              />
            </div>
            <Separator />
            <Button type="submit" disabled={pwSaving} className="font-semibold">
              {pwSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>

      </div>{/* end left column */}

      {/* ── RIGHT COLUMN ── */}
      <div className="space-y-6">

      {/* Billing Status */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Subscription &amp; Billing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current status */}
          {(() => {
            const cfg = BILLING_STATUS_CONFIG[shop.billingStatus];
            const Icon = cfg.icon;
            return (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${cfg.color}`} />
                  <div>
                    <p className="font-semibold">{plan.label} Plan — {cfg.label}</p>
                    <p className="text-sm text-muted-foreground">{plan.price}</p>
                  </div>
                </div>
                <Badge>{shop.planTier}</Badge>
              </div>
            );
          })()}

          {/* Status-specific info */}
          {shop.billingStatus === "TRIAL" && shop.trialEndsAt && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
              <p className="font-medium text-blue-800">
                Trial ends {fmtDate(shop.trialEndsAt)}
              </p>
              <p className="text-blue-700 text-xs mt-1">
                Contact us via WhatsApp to continue after your trial.
              </p>
            </div>
          )}

          {shop.billingStatus === "GRACE" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <p className="font-medium text-amber-800">
                Payment overdue — {graceDaysLeft !== null && graceDaysLeft > 0
                  ? `${graceDaysLeft} day${graceDaysLeft !== 1 ? "s" : ""} until locked`
                  : `access locked after ${fmtDate(shop.gracePeriodEndsAt)}`}
              </p>
              <p className="text-amber-700 text-xs mt-1">
                Contact us immediately via WhatsApp to arrange payment.
              </p>
            </div>
          )}

          {shop.billingStatus === "LOCKED" && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm">
              <p className="font-medium text-red-800">Account locked — new sales disabled</p>
              <p className="text-red-700 text-xs mt-1">
                Contact us via WhatsApp to restore access. Your data is safe.
              </p>
            </div>
          )}

          {shop.billingStatus === "ACTIVE" && shop.nextBillingDate && (
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                Next billing date: <span className="font-medium text-foreground">{fmtDate(shop.nextBillingDate)}</span>
              </p>
            </div>
          )}

          <Separator />

          {/* Plan tiers */}
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Available Plans</p>
            {[
              { tier: "BASIC",    label: "Basic — LKR 5,000/mo",  desc: "1 device, up to 500 products, POS & inventory" },
              { tier: "STANDARD", label: "Standard — LKR 8,000/mo", desc: "3 devices, unlimited products, customers & expenses" },
              { tier: "PREMIUM",  label: "Premium — LKR 13,000/mo", desc: "Unlimited devices, advanced analytics, priority support" },
            ].map((t) => (
              <div
                key={t.tier}
                className={`flex items-start justify-between rounded-lg border p-3 ${
                  shop.planTier === t.tier ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div>
                  <p className="font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
                {shop.planTier === t.tier ? (
                  <Badge variant="secondary" className="text-xs">Current</Badge>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Contact us to upgrade</p>
                )}
              </div>
            ))}
          </div>

          {/* Payment history */}
          {shop.payments.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment History</p>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Month</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Plan</th>
                        <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Amount</th>
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Paid On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shop.payments.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium">{p.billingMonth}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.planTier}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {p.currency} {p.amount.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.paidAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Devices ───────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            Registered Devices
          </CardTitle>
          <CardDescription>
            {(() => {
              const limit = DEVICE_LIMITS[shop.planTier];
              const used  = devices.length;
              return limit === Infinity
                ? `${used} device${used !== 1 ? "s" : ""} registered — unlimited on ${shop.planTier} plan`
                : `${used} / ${limit} device${limit !== 1 ? "s" : ""} used on ${shop.planTier} plan`;
            })()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {devicesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading devices…
            </div>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No devices registered.</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border overflow-hidden">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center gap-3 px-4 py-3 bg-background">
                  <Monitor className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{device.deviceName}</p>
                      {device.isCurrent && (
                        <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" /> This device
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last seen {new Date(device.lastSeenAt).toLocaleString("en-LK", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {device.isCurrent ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => signOut({ callbackUrl: "/login" })}
                    >
                      Sign out
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => removeDevice(device.id)}
                      disabled={removingId === device.id}
                    >
                      {removingId === device.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Removing a device signs them out immediately on their next action.
            To free up a slot, remove an inactive device or upgrade your plan.

          </p>
        </CardContent>
      </Card>

      </div>{/* end right column */}
      </div>{/* end grid */}
    </div>
  );
}
