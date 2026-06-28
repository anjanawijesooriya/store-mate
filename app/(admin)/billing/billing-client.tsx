"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle,
  Lock,
  Unlock,
  RefreshCcw,
  Loader2,
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type BillingStatus = "TRIAL" | "ACTIVE" | "GRACE" | "LOCKED";
type PlanTier = "BASIC" | "STANDARD" | "PREMIUM";

interface Shop {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  category: string;
  planTier: PlanTier;
  billingStatus: BillingStatus;
  trialEndsAt: Date | null;
  gracePeriodEndsAt: Date | null;
  nextBillingDate: Date | null;
  createdAt: Date;
  payments: Array<{ paidAt: Date; amount: number; billingMonth: string }>;
  _count: { sales: number; products: number };
}

const STATUS_STYLES: Record<BillingStatus, string> = {
  TRIAL: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  ACTIVE: "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20",
  GRACE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  LOCKED: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
};

const PLAN_PRICES: Record<PlanTier, string> = {
  BASIC: "LKR 2,000",
  STANDARD: "LKR 3,500",
  PREMIUM: "LKR 5,000",
};

function fmt(d: Date | null | string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" });
}

function daysLeft(d: Date | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

export function AdminBillingClient({ shops: initial }: { shops: Shop[] }) {
  const [shops, setShops] = useState<Shop[]>(initial);
  const [markPaidShop, setMarkPaidShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const [paidForm, setPaidForm] = useState({
    amount: "",
    planTier: "STANDARD" as PlanTier,
    billingMonth: new Date().toISOString().slice(0, 7),
    reference: "",
    note: "",
  });

  async function callAdmin(shopId: string, body: object) {
    const res = await fetch(`/api/admin/billing/${shopId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function refresh() {
    const res = await fetch("/api/admin/shops");
    if (res.ok) setShops((await res.json()).shops);
  }

  async function handleAction(shop: Shop, action: string, extra?: object) {
    setLoading(shop.id + action);
    try {
      await callAdmin(shop.id, { action, ...extra });
      toast.success("Updated successfully");
      await refresh();
    } catch {
      toast.error("Action failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleMarkPaid() {
    if (!markPaidShop) return;
    setLoading(markPaidShop.id + "mark_paid");
    try {
      await callAdmin(markPaidShop.id, {
        action: "mark_paid",
        amount: parseFloat(paidForm.amount),
        planTier: paidForm.planTier,
        billingMonth: paidForm.billingMonth,
        reference: paidForm.reference || undefined,
        note: paidForm.note || undefined,
      });
      toast.success(`Payment recorded for ${markPaidShop.name}`);
      setMarkPaidShop(null);
      await refresh();
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setLoading(null);
    }
  }

  const summary = {
    total: shops.length,
    trial: shops.filter((s) => s.billingStatus === "TRIAL").length,
    active: shops.filter((s) => s.billingStatus === "ACTIVE").length,
    grace: shops.filter((s) => s.billingStatus === "GRACE").length,
    locked: shops.filter((s) => s.billingStatus === "LOCKED").length,
  };

  const summaryCards = [
    { label: "Total Shops", count: summary.total, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Active", count: summary.active, icon: TrendingUp, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
    { label: "Trial", count: summary.trial, icon: Clock, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
    { label: "Grace / Locked", count: summary.grace + summary.locked, icon: ShieldAlert, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Billing Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">{shops.length} shop{shops.length !== 1 ? "s" : ""} registered</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await refresh();
            toast.success("Refreshed");
          }}
          className="gap-2"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {summaryCards.map((s) => (
          <Card key={s.label} className="shadow-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/40 via-primary/10 to-transparent" />
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className="mt-2 text-3xl font-bold text-foreground tabular-nums">{s.count}</p>
                </div>
                <div className={`p-2 rounded-xl flex-shrink-0 ${s.bg} ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Shops table */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="pb-0 px-6 pt-5 border-b border-border">
          <CardTitle className="text-base font-semibold">All Shops</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                {["Shop", "Owner", "Plan", "Status", "Key Date", "Activity", "Actions"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => {
                const dl =
                  shop.billingStatus === "TRIAL"
                    ? daysLeft(shop.trialEndsAt)
                    : shop.billingStatus === "GRACE"
                    ? daysLeft(shop.gracePeriodEndsAt)
                    : null;

                const keyDate =
                  shop.billingStatus === "TRIAL"
                    ? `Trial ends ${fmt(shop.trialEndsAt)}`
                    : shop.billingStatus === "ACTIVE"
                    ? `Next billing ${fmt(shop.nextBillingDate)}`
                    : shop.billingStatus === "GRACE"
                    ? `Grace ends ${fmt(shop.gracePeriodEndsAt)}`
                    : "Locked";

                return (
                  <tr key={shop.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-foreground">{shop.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{shop.phone}</p>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{shop.ownerName}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-mono text-xs font-semibold text-foreground">{PLAN_PRICES[shop.planTier]}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{shop.planTier}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[shop.billingStatus]}`}
                      >
                        {shop.billingStatus}
                      </span>
                      {dl !== null && (
                        <p className={`text-xs mt-1 font-medium ${dl <= 3 ? "text-red-500" : "text-muted-foreground"}`}>
                          {dl > 0 ? `${dl}d left` : "Expired"}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{keyDate}</td>
                    <td className="px-4 py-3.5">
                      <p className="text-xs text-foreground font-medium">{shop._count.sales} sales</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{shop._count.products} products</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 px-2.5 gap-1"
                          onClick={() => {
                            setPaidForm({
                              amount: PLAN_PRICES[shop.planTier].replace(/\D/g, ""),
                              planTier: shop.planTier,
                              billingMonth: new Date().toISOString().slice(0, 7),
                              reference: "",
                              note: "",
                            });
                            setMarkPaidShop(shop);
                          }}
                        >
                          <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                          Mark Paid
                        </Button>

                        {shop.billingStatus === "LOCKED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2.5 gap-1"
                            disabled={loading === shop.id + "unlock"}
                            onClick={() => handleAction(shop, "unlock")}
                          >
                            {loading === shop.id + "unlock" ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Unlock className="h-3 w-3 text-primary" />
                            )}
                            Unlock
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2.5 gap-1 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/30"
                            disabled={loading === shop.id + "lock"}
                            onClick={() => handleAction(shop, "lock")}
                          >
                            {loading === shop.id + "lock" ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Lock className="h-3 w-3" />
                            )}
                            Lock
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7 px-2.5 text-muted-foreground hover:text-foreground"
                          disabled={loading === shop.id + "extend_trial"}
                          onClick={() => handleAction(shop, "extend_trial", { days: 14 })}
                        >
                          {loading === shop.id + "extend_trial" ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : null}
                          +14d Trial
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {shops.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No shops registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mark as Paid dialog */}
      <Dialog open={!!markPaidShop} onOpenChange={(o) => !o && setMarkPaidShop(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              Record Payment — {markPaidShop?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Amount (LKR)</Label>
                <Input
                  type="number"
                  value={paidForm.amount}
                  onChange={(e) => setPaidForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="2000"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Billing Month</Label>
                <Input
                  type="month"
                  value={paidForm.billingMonth}
                  onChange={(e) => setPaidForm((p) => ({ ...p, billingMonth: e.target.value }))}
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Plan Tier</Label>
              <Select
                value={paidForm.planTier}
                onValueChange={(v) => setPaidForm((p) => ({ ...p, planTier: v as PlanTier }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BASIC">Basic — LKR 2,000/mo</SelectItem>
                  <SelectItem value="STANDARD">Standard — LKR 3,500/mo</SelectItem>
                  <SelectItem value="PREMIUM">Premium — LKR 5,000/mo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Reference <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                value={paidForm.reference}
                onChange={(e) => setPaidForm((p) => ({ ...p, reference: e.target.value }))}
                placeholder="Bank transfer ref, screenshot ID..."
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Note <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                value={paidForm.note}
                onChange={(e) => setPaidForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Discount applied, partial payment..."
                className="h-10"
              />
            </div>

            <Separator />

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setMarkPaidShop(null)}>
                Cancel
              </Button>
              <Button
                disabled={!paidForm.amount || !paidForm.planTier || loading === markPaidShop?.id + "mark_paid"}
                onClick={handleMarkPaid}
                className="gap-2"
              >
                {loading === markPaidShop?.id + "mark_paid" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Record Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
