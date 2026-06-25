"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Settings, Store, Bell, CreditCard, Loader2 } from "lucide-react";
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
}

const PLAN_LABELS: Record<string, { label: string; price: string; color: string }> = {
  BASIC: { label: "Basic", price: "LKR 2,000/mo", color: "secondary" },
  STANDARD: { label: "Standard", price: "LKR 3,500/mo", color: "default" },
  PREMIUM: { label: "Premium", price: "LKR 5,000/mo", color: "default" },
};

export function SettingsClient({ shop }: { shop: Shop }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: shop.name,
    ownerName: shop.ownerName,
    address: shop.address ?? "",
  });

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

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Settings" description="Manage your shop and account settings" />

      {/* Billing status */}
      {trialDaysLeft !== null && (
        <div className={`rounded-lg border px-4 py-3 flex items-center justify-between ${
          trialDaysLeft <= 7 ? "border-[color:var(--brand-warning)]/30 bg-[color:var(--brand-warning)]/10" : "border-[color:var(--brand-success)]/30 bg-[color:var(--brand-success)]/10"
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
          <Button size="sm" className="font-semibold flex-shrink-0 ml-4">
            Upgrade Now
          </Button>
        </div>
      )}

      {/* Shop info */}
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
              <div key={t.tier} className={`flex items-start justify-between rounded-lg border p-3 ${shop.planTier === t.tier ? "border-primary bg-primary/5" : "border-border"}`}>
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

      {/* SMS Notifications */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            SMS Notifications
          </CardTitle>
          <CardDescription>Configure which alerts are sent to your phone</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { id: "lowstock", label: "Low Stock Alert", desc: "Get notified when products run low" },
              { id: "dailysummary", label: "Daily Sales Summary", desc: "Receive a daily summary at 9 PM" },
              { id: "receiptsms", label: "Customer Receipt SMS", desc: "Send receipts via SMS to customers" },
            ].map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <button
                  className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-primary transition-colors focus:outline-none"
                  role="switch"
                  aria-checked="true"
                >
                  <span className="translate-x-5 inline-block h-5 w-5 transform rounded-full bg-white shadow transition" />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
