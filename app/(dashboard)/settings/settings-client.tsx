"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Store, Bell, CreditCard, Loader2, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Shop {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  category: string;
  address: string | null;
  planTier: string;
  trialEndsAt: Date | null;
  smsLowStock: boolean;
  smsDailySummary: boolean;
  smsReceiptEnabled: boolean;
  smsMonthlyUsage: number;
}

const PLAN_LABELS: Record<string, { label: string; price: string }> = {
  BASIC: { label: "Basic", price: "LKR 2,000/mo" },
  STANDARD: { label: "Standard", price: "LKR 3,500/mo" },
  PREMIUM: { label: "Premium", price: "LKR 5,000/mo" },
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

export function SettingsClient({ shop }: { shop: Shop }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: shop.name,
    ownerName: shop.ownerName,
    address: shop.address ?? "",
  });

  const [smsPrefs, setSmsPrefs] = useState({
    smsLowStock: shop.smsLowStock,
    smsDailySummary: shop.smsDailySummary,
    smsReceiptEnabled: shop.smsReceiptEnabled,
  });
  const [smsSaving, setSmsSaving] = useState(false);

  const plan = PLAN_LABELS[shop.planTier] ?? PLAN_LABELS.BASIC;
  const trialDaysLeft = shop.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(shop.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/shop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { toast.error("Failed to save settings"); return; }
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
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Settings" description="Manage your shop and account settings" />

      {trialDaysLeft !== null && (
        <div className={`rounded-lg border px-4 py-3 flex items-center justify-between ${
          trialDaysLeft <= 7
            ? "border-[color:var(--brand-warning)]/30 bg-[color:var(--brand-warning)]/10"
            : "border-[color:var(--brand-success)]/30 bg-[color:var(--brand-success)]/10"
        }`}>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {trialDaysLeft > 0 ? `Free Trial — ${trialDaysLeft} days remaining` : "Trial Ended"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {trialDaysLeft > 0
                ? "No credit card required during trial. Upgrade anytime."
                : "Your free trial has ended. Please upgrade to continue using StoreMate."}
            </p>
          </div>
          <Button size="sm" className="font-semibold flex-shrink-0 ml-4">Upgrade Now</Button>
        </div>
      )}

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
                <p className="text-sm font-medium capitalize">{shop.category.toLowerCase()}</p>
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
            Configure which alerts are sent to your phone
            {shop.smsMonthlyUsage > 0 && (
              <span className="ml-2 text-xs">· {shop.smsMonthlyUsage} SMS sent this month</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
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
          <p className="text-xs text-muted-foreground rounded-md bg-muted px-3 py-2">
            Requires Notify.lk credentials in your environment variables to send real SMS.
          </p>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{plan.label} Plan</p>
              <p className="text-sm text-muted-foreground">{plan.price}</p>
            </div>
            <Badge>{shop.planTier}</Badge>
          </div>
          <Separator />
          <div className="space-y-2 text-sm">
            {[
              { tier: "BASIC", label: "Basic — LKR 2,000/mo", desc: "1 device, up to 500 products" },
              { tier: "STANDARD", label: "Standard — LKR 3,500/mo", desc: "3 devices, unlimited products, 100 SMS/mo" },
              { tier: "PREMIUM", label: "Premium — LKR 5,000/mo", desc: "Unlimited devices, unlimited SMS, priority support" },
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
                  <Button size="sm" variant="outline" className="text-xs">Upgrade</Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
