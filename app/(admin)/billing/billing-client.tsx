"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle, Lock, Unlock, RefreshCcw, Loader2,
  Users, TrendingUp, Clock, ShieldAlert, MessageSquare,
  MoreVertical, Trash2, Plus, WifiOff, Play, Receipt,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CATEGORY_LABELS } from "@/lib/shop-categories";

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
  payments: Array<{ paidAt: Date; amount: number; billingMonth: string; planTier: string; reference: string | null; note: string | null }>;
  _count: { sales: number; products: number };
  smsAddonEnabled: boolean;
  smsCredits: number;
}

const STATUS_CONFIG: Record<BillingStatus, { label: string; className: string }> = {
  TRIAL:  { label: "Trial",  className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  ACTIVE: { label: "Active", className: "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20" },
  GRACE:  { label: "Grace",  className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" },
  LOCKED: { label: "Locked", className: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" },
};

const PLAN_CONFIG: Record<PlanTier, { label: string; price: string; className: string }> = {
  BASIC:    { label: "Basic",    price: "LKR 5,000",  className: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20" },
  STANDARD: { label: "Standard", price: "LKR 8,000",  className: "bg-primary/10 text-primary border border-primary/20" },
  PREMIUM:  { label: "Premium",  price: "LKR 13,000", className: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20" },
};


function fmt(d: Date | null | string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" });
}

function daysLeft(d: Date | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

const SMS_PRESETS = [10, 50, 100, 200];

export function AdminBillingClient({ shops: initial }: { shops: Shop[] }) {
  const [shops, setShops] = useState<Shop[]>(initial);
  const [loading, setLoading] = useState<string | null>(null);

  // Dialog state
  const [markPaidShop, setMarkPaidShop]     = useState<Shop | null>(null);
  const [smsCreditsShop, setSmsCreditsShop]       = useState<Shop | null>(null);
  const [payHistoryShop, setPayHistoryShop]       = useState<Shop | null>(null);
  const [smsEnableMode, setSmsEnableMode]   = useState(false); // true = enabling addon + credits together
  const [smsDisableShop, setSmsDisableShop] = useState<Shop | null>(null);
  const [deleteShop, setDeleteShop]         = useState<Shop | null>(null);

  const [paidForm, setPaidForm] = useState({
    amount: "", planTier: "STANDARD" as PlanTier,
    billingMonth: new Date().toISOString().slice(0, 7),
    reference: "", note: "",
  });
  const [smsCreditsAmount, setSmsCreditsAmount] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

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

  async function handleAddCredits() {
    if (!smsCreditsShop) return;
    const amount = parseInt(smsCreditsAmount);
    if (!amount || amount <= 0) return;
    setLoading(smsCreditsShop.id + "sms_credits");
    try {
      // If enabling mode, enable addon first then add credits
      if (smsEnableMode) {
        const enableRes = await fetch("/api/admin/sms-addon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopId: smsCreditsShop.id, enabled: true }),
        });
        if (!enableRes.ok) throw new Error("Failed to enable SMS add-on");
      }
      const creditsRes = await fetch("/api/admin/sms-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: smsCreditsShop.id, credits: amount }),
      });
      if (!creditsRes.ok) throw new Error("Failed to add credits");
      toast.success(smsEnableMode
        ? `SMS add-on enabled with ${amount} credits for ${smsCreditsShop.name}`
        : `Added ${amount} SMS credits to ${smsCreditsShop.name}`
      );
      setSmsCreditsShop(null);
      setSmsCreditsAmount("");
      setSmsEnableMode(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleSmsToggle(shop: Shop, enabled: boolean) {
    setLoading(shop.id + "sms_addon");
    try {
      const res = await fetch("/api/admin/sms-addon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: shop.id, enabled }),
      });
      if (!res.ok) throw new Error();
      toast.success(`SMS add-on ${enabled ? "enabled" : "disabled"} for ${shop.name}`);
      setSmsDisableShop(null);
      await refresh();
    } catch {
      toast.error("Failed to update SMS add-on");
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!deleteShop || deleteConfirmName !== deleteShop.name) return;
    setLoading(deleteShop.id + "delete");
    try {
      const res = await fetch(`/api/admin/shops/${deleteShop.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`${deleteShop.name} deleted permanently`);
      setDeleteShop(null);
      setDeleteConfirmName("");
      await refresh();
    } catch {
      toast.error("Failed to delete shop");
    } finally {
      setLoading(null);
    }
  }

  const summary = {
    total:  shops.length,
    active: shops.filter((s) => s.billingStatus === "ACTIVE").length,
    trial:  shops.filter((s) => s.billingStatus === "TRIAL").length,
    atRisk: shops.filter((s) => s.billingStatus === "GRACE" || s.billingStatus === "LOCKED").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Billing Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">{shops.length} shop{shops.length !== 1 ? "s" : ""} registered</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={loading === "billing_check"}
            onClick={async () => {
              setLoading("billing_check");
              try {
                const res = await fetch("/api/admin/run-billing-check", { method: "POST" });
                const data = await res.json();
                if (!res.ok) throw new Error();
                if (data.transitioned === 0) {
                  toast.success("Billing check complete — all shops up to date");
                } else {
                  toast.success(`Billing check: ${data.transitioned} shop${data.transitioned !== 1 ? "s" : ""} transitioned`);
                  data.log?.forEach((line: string) => toast.info(line, { duration: 6000 }));
                }
                await refresh();
              } catch {
                toast.error("Billing check failed");
              } finally {
                setLoading(null);
              }
            }}
          >
            {loading === "billing_check"
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Play className="h-4 w-4" />}
            Run Billing Check
          </Button>
          <Button variant="outline" size="sm" className="gap-2"
            onClick={async () => { await refresh(); toast.success("Refreshed"); }}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Shops",   count: summary.total,  icon: Users,      color: "text-primary",                               bg: "bg-primary/10" },
          { label: "Active",        count: summary.active, icon: TrendingUp,  color: "text-green-600 dark:text-green-400",         bg: "bg-green-500/10" },
          { label: "Trial",         count: summary.trial,  icon: Clock,       color: "text-blue-600 dark:text-blue-400",           bg: "bg-blue-500/10" },
          { label: "Grace / Locked",count: summary.atRisk, icon: ShieldAlert, color: "text-red-600 dark:text-red-400",             bg: "bg-red-500/10" },
        ].map((s) => (
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
                {["Shop", "Plan & SMS", "Status", "Key Date", "Activity", "Last Payment", ""].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => {
                const dl = shop.billingStatus === "TRIAL"
                  ? daysLeft(shop.trialEndsAt)
                  : shop.billingStatus === "GRACE"
                  ? daysLeft(shop.gracePeriodEndsAt)
                  : null;

                const keyDate = shop.billingStatus === "TRIAL"   ? `Trial ends ${fmt(shop.trialEndsAt)}`
                  : shop.billingStatus === "ACTIVE"  ? `Next billing ${fmt(shop.nextBillingDate)}`
                  : shop.billingStatus === "GRACE"   ? `Grace ends ${fmt(shop.gracePeriodEndsAt)}`
                  : "Locked — no access";

                const lastPayment = shop.payments[0];
                const plan = PLAN_CONFIG[shop.planTier];
                const status = STATUS_CONFIG[shop.billingStatus];

                return (
                  <tr key={shop.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    {/* Shop */}
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-foreground">{shop.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{shop.ownerName}</p>
                      <p className="text-xs text-muted-foreground">{shop.phone}</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{CATEGORY_LABELS[shop.category] ?? shop.category}</p>
                      <p className="text-xs text-muted-foreground/50 mt-0.5">Since {fmt(shop.createdAt)}</p>
                    </td>

                    {/* Plan & SMS */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${plan.className}`}>
                        {plan.label} · {plan.price}
                      </span>
                      <div className="mt-1.5">
                        {shop.smsAddonEnabled ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                            <MessageSquare className="h-3 w-3" />
                            SMS · {shop.smsCredits} credits
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <WifiOff className="h-3 w-3" />
                            SMS off
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                      {dl !== null && (
                        <p className={`text-xs mt-1 font-medium ${dl <= 3 ? "text-red-500" : "text-muted-foreground"}`}>
                          {dl > 0 ? `${dl}d left` : "Expired"}
                        </p>
                      )}
                    </td>

                    {/* Key date */}
                    <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{keyDate}</td>

                    {/* Activity */}
                    <td className="px-4 py-3.5">
                      <p className="text-xs font-medium text-foreground">{shop._count.sales} sales</p>
                      <p className="text-xs text-muted-foreground">{shop._count.products} products</p>
                    </td>

                    {/* Last payment */}
                    <td className="px-4 py-3.5">
                      {lastPayment ? (
                        <>
                          <p className="text-xs font-medium text-foreground">LKR {lastPayment.amount.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{lastPayment.billingMonth}</p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">No payments</p>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 px-3 gap-1.5"
                          onClick={() => {
                            setPaidForm({
                              amount: PLAN_CONFIG[shop.planTier].price.replace(/\D/g, ""),
                              planTier: shop.planTier,
                              billingMonth: new Date().toISOString().slice(0, 7),
                              reference: "", note: "",
                            });
                            setMarkPaidShop(shop);
                          }}
                        >
                          <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                          Mark Paid
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger render={
                            <button className="h-8 w-8 flex items-center justify-center rounded-md border border-border hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              {loading?.startsWith(shop.id) ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                              ) : (
                                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </button>
                          } />
                          <DropdownMenuContent align="end" className="w-48">
                            {/* Lock / Unlock */}
                            {shop.billingStatus === "LOCKED" ? (
                              <DropdownMenuItem onClick={() => handleAction(shop, "unlock")} className="gap-2">
                                <Unlock className="h-3.5 w-3.5 text-primary" />
                                Unlock shop
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleAction(shop, "lock")} className="gap-2 text-amber-600 dark:text-amber-400 focus:text-amber-600">
                                <Lock className="h-3.5 w-3.5" />
                                Lock shop
                              </DropdownMenuItem>
                            )}

                            {/* Extend trial */}
                            <DropdownMenuItem onClick={() => handleAction(shop, "extend_trial", { days: 14 })} className="gap-2">
                              <Clock className="h-3.5 w-3.5" />
                              Extend trial +14 days
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => setPayHistoryShop(shop)} className="gap-2">
                              <Receipt className="h-3.5 w-3.5" />
                              Payment history
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* SMS toggle */}
                            {shop.smsAddonEnabled ? (
                              <>
                                <DropdownMenuItem onClick={() => setSmsDisableShop(shop)} className="gap-2 text-amber-600 dark:text-amber-400 focus:text-amber-600">
                                  <WifiOff className="h-3.5 w-3.5" />
                                  Disable SMS add-on
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSmsCreditsShop(shop); setSmsCreditsAmount(""); }} className="gap-2">
                                  <Plus className="h-3.5 w-3.5" />
                                  Add SMS credits
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem onClick={() => { setSmsCreditsShop(shop); setSmsCreditsAmount(""); setSmsEnableMode(true); }} className="gap-2">
                                <MessageSquare className="h-3.5 w-3.5" />
                                Enable SMS add-on
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            {/* Delete */}
                            <DropdownMenuItem
                              onClick={() => { setDeleteShop(shop); setDeleteConfirmName(""); }}
                              className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete shop
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {shops.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-sm text-muted-foreground">
                    No shops registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Mark as Paid dialog ── */}
      <Dialog open={!!markPaidShop} onOpenChange={(o) => !o && setMarkPaidShop(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              Record Payment
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Recording payment for <span className="font-semibold text-foreground">{markPaidShop?.name}</span>
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Plan Tier</Label>
              <Select
                value={paidForm.planTier}
                onValueChange={(v) => {
                  const tier = v as PlanTier;
                  const price = PLAN_CONFIG[tier].price.replace(/\D/g, "");
                  setPaidForm((p) => ({ ...p, planTier: tier, amount: price }));
                }}
              >
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="w-max min-w-(--anchor-width)">
                  <SelectItem value="BASIC">Basic — LKR 5,000/mo</SelectItem>
                  <SelectItem value="STANDARD">Standard — LKR 8,000/mo</SelectItem>
                  <SelectItem value="PREMIUM">Premium — LKR 13,000/mo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Amount (LKR)</Label>
                <Input type="number" value={paidForm.amount} className="h-10"
                  onChange={(e) => setPaidForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="8000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Billing Month</Label>
                <Input type="month" value={paidForm.billingMonth} className="h-10"
                  onChange={(e) => setPaidForm((p) => ({ ...p, billingMonth: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Reference <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={paidForm.reference} className="h-10"
                onChange={(e) => setPaidForm((p) => ({ ...p, reference: e.target.value }))}
                placeholder="Bank transfer ref, screenshot ID…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={paidForm.note} className="h-10"
                onChange={(e) => setPaidForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Discount applied, partial payment…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidShop(null)}>Cancel</Button>
            <Button
              disabled={!paidForm.amount || loading === markPaidShop?.id + "mark_paid"}
              onClick={handleMarkPaid} className="gap-2"
            >
              {loading === markPaidShop?.id + "mark_paid"
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckCircle className="h-4 w-4" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add SMS Credits dialog ── */}
      <Dialog open={!!smsCreditsShop} onOpenChange={(o) => { if (!o) { setSmsCreditsShop(null); setSmsCreditsAmount(""); setSmsEnableMode(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {smsEnableMode ? "Enable SMS Add-on" : "Add SMS Credits"}
            </DialogTitle>
          </DialogHeader>
          {smsEnableMode && (
            <p className="text-sm text-muted-foreground -mt-1">
              Set the opening credit balance for <span className="font-semibold text-foreground">{smsCreditsShop?.name}</span>. SMS will activate immediately.
            </p>
          )}
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{smsCreditsShop?.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Current balance</p>
              </div>
              <span className="text-2xl font-bold text-foreground tabular-nums">{smsCreditsShop?.smsCredits ?? 0}</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Credits to add</Label>
              <div className="flex gap-2 flex-wrap">
                {SMS_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setSmsCreditsAmount(String(preset))}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                      smsCreditsAmount === String(preset)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border bg-card hover:bg-muted text-foreground"
                    }`}
                  >
                    +{preset}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                min="1"
                value={smsCreditsAmount}
                onChange={(e) => setSmsCreditsAmount(e.target.value)}
                placeholder="Or enter custom amount"
                className="h-10 mt-2"
              />
            </div>

            {smsCreditsAmount && parseInt(smsCreditsAmount) > 0 && (
              <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary">
                New balance will be <span className="font-bold">{(smsCreditsShop?.smsCredits ?? 0) + parseInt(smsCreditsAmount)} credits</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSmsCreditsShop(null); setSmsCreditsAmount(""); }}>Cancel</Button>
            <Button
              disabled={!smsCreditsAmount || parseInt(smsCreditsAmount) <= 0 || loading === smsCreditsShop?.id + "sms_credits"}
              onClick={handleAddCredits} className="gap-2"
            >
              {loading === smsCreditsShop?.id + "sms_credits"
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Plus className="h-4 w-4" />}
              {smsEnableMode ? "Enable & Add Credits" : "Add Credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Disable SMS add-on confirm dialog ── */}
      <Dialog open={!!smsDisableShop} onOpenChange={(o) => !o && setSmsDisableShop(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <WifiOff className="h-5 w-5" />
              Disable SMS Add-on
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are about to disable the SMS add-on for{" "}
              <span className="font-semibold text-foreground">{smsDisableShop?.name}</span>.
            </p>
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 space-y-1.5 text-xs text-amber-700 dark:text-amber-400">
              <p>• SMS receipts will stop sending immediately</p>
              <p>• Low-stock and daily summary alerts will be paused</p>
              <p>• Remaining credits ({smsDisableShop?.smsCredits ?? 0}) are preserved and restored if re-enabled</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmsDisableShop(null)}>Cancel</Button>
            <Button
              variant="outline"
              className="gap-2 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              disabled={loading === smsDisableShop?.id + "sms_addon"}
              onClick={() => smsDisableShop && handleSmsToggle(smsDisableShop, false)}
            >
              {loading === smsDisableShop?.id + "sms_addon"
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <WifiOff className="h-4 w-4" />}
              Disable SMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Payment history dialog ── */}
      <Dialog open={!!payHistoryShop} onOpenChange={(o) => !o && setPayHistoryShop(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Payment History — {payHistoryShop?.name}
            </DialogTitle>
          </DialogHeader>
          {payHistoryShop?.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    {["Month", "Plan", "Amount", "Date", "Reference / Note"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payHistoryShop?.payments.map((p, i) => (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{p.billingMonth}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{p.planTier}</td>
                      <td className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">LKR {p.amount.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmt(p.paidAt)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {p.reference
                          ? <span title={p.reference}>{p.reference}</span>
                          : p.note
                          ? <span className="italic" title={p.note}>{p.note}</span>
                          : <span className="text-muted-foreground/50">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-between items-center pt-1 text-xs text-muted-foreground">
            <span>{payHistoryShop?.payments.length ?? 0} payment{(payHistoryShop?.payments.length ?? 0) !== 1 ? "s" : ""} total</span>
            <span>
              Total collected: LKR {(payHistoryShop?.payments.reduce((s, p) => s + p.amount, 0) ?? 0).toLocaleString()}
            </span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayHistoryShop(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete shop dialog ── */}
      <Dialog open={!!deleteShop} onOpenChange={(o) => { if (!o) { setDeleteShop(null); setDeleteConfirmName(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Shop Permanently
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 space-y-1.5 text-xs text-destructive">
              <p className="font-semibold text-sm">This action cannot be undone.</p>
              <p>All data for <span className="font-semibold">{deleteShop?.name}</span> will be permanently deleted:</p>
              <p>• {deleteShop?._count.sales ?? 0} sales records</p>
              <p>• {deleteShop?._count.products ?? 0} products</p>
              <p>• All customers, expenses, payments, devices &amp; users</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Type <span className="font-mono font-bold text-foreground">{deleteShop?.name}</span> to confirm
              </Label>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={deleteShop?.name}
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteShop(null); setDeleteConfirmName(""); }}>Cancel</Button>
            <Button
              variant="outline"
              className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              disabled={deleteConfirmName !== deleteShop?.name || loading === deleteShop?.id + "delete"}
              onClick={handleDelete}
            >
              {loading === deleteShop?.id + "delete"
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Trash2 className="h-4 w-4" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
