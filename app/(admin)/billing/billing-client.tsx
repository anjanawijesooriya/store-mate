"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle, Lock, Unlock, ChevronDown, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const STATUS_COLORS: Record<BillingStatus, string> = {
  TRIAL: "bg-blue-100 text-blue-800",
  ACTIVE: "bg-green-100 text-green-800",
  GRACE: "bg-amber-100 text-amber-800",
  LOCKED: "bg-red-100 text-red-800",
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

  // Mark-paid form state
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

  async function handleAction(shop: Shop, action: string, extra?: object) {
    setLoading(shop.id + action);
    try {
      await callAdmin(shop.id, { action, ...extra });
      toast.success("Updated successfully");
      // Refresh the data
      const res = await fetch("/api/admin/shops");
      if (res.ok) {
        const data = await res.json();
        setShops(data.shops);
      }
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
      const res = await fetch("/api/admin/shops");
      if (res.ok) setShops((await res.json()).shops);
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">{shops.length} shops total</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const res = await fetch("/api/admin/shops");
            if (res.ok) setShops((await res.json()).shops);
            toast.success("Refreshed");
          }}
        >
          <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Trial", count: summary.trial, color: "text-blue-700" },
          { label: "Active", count: summary.active, color: "text-green-700" },
          { label: "Grace", count: summary.grace, color: "text-amber-700" },
          { label: "Locked", count: summary.locked, color: "text-red-700" },
        ].map((s) => (
          <Card key={s.label} className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Shop table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Shops</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {["Shop", "Owner", "Plan", "Status", "Key Date", "Activity", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">
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
                    <tr key={shop.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium">{shop.name}</p>
                        <p className="text-xs text-muted-foreground">{shop.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{shop.ownerName}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs">{PLAN_PRICES[shop.planTier]}</span>
                        <p className="text-xs text-muted-foreground">{shop.planTier}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[shop.billingStatus]}`}
                        >
                          {shop.billingStatus}
                        </span>
                        {dl !== null && (
                          <p className={`text-xs mt-0.5 ${dl <= 3 ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                            {dl > 0 ? `${dl}d left` : "Expired"}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{keyDate}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <p>{shop._count.sales} sales</p>
                        <p>{shop._count.products} products</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2"
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
                            <CheckCircle className="h-3 w-3 mr-1" /> Mark Paid
                          </Button>

                          {shop.billingStatus === "LOCKED" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2"
                              disabled={loading === shop.id + "unlock"}
                              onClick={() => handleAction(shop, "unlock")}
                            >
                              <Unlock className="h-3 w-3 mr-1" /> Unlock
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2 text-red-600 border-red-200 hover:bg-red-50"
                              disabled={loading === shop.id + "lock"}
                              onClick={() => handleAction(shop, "lock")}
                            >
                              <Lock className="h-3 w-3 mr-1" /> Lock
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 px-2 text-muted-foreground"
                            disabled={loading === shop.id + "extend_trial"}
                            onClick={() => handleAction(shop, "extend_trial", { days: 14 })}
                          >
                            +14d Trial
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mark as Paid dialog */}
      <Dialog open={!!markPaidShop} onOpenChange={(o) => !o && setMarkPaidShop(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment — {markPaidShop?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (LKR)</Label>
                <Input
                  type="number"
                  value={paidForm.amount}
                  onChange={(e) => setPaidForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="2000"
                />
              </div>
              <div className="space-y-2">
                <Label>Billing Month</Label>
                <Input
                  type="month"
                  value={paidForm.billingMonth}
                  onChange={(e) => setPaidForm((p) => ({ ...p, billingMonth: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Plan Tier</Label>
              <Select
                value={paidForm.planTier}
                onValueChange={(v) => setPaidForm((p) => ({ ...p, planTier: v as PlanTier }))}
              >
                <SelectTrigger>
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
              <Label>Reference (optional)</Label>
              <Input
                value={paidForm.reference}
                onChange={(e) => setPaidForm((p) => ({ ...p, reference: e.target.value }))}
                placeholder="Bank transfer ref, WhatsApp screenshot ID..."
              />
            </div>

            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input
                value={paidForm.note}
                onChange={(e) => setPaidForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Discount applied, partial payment..."
              />
            </div>

            <Separator />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setMarkPaidShop(null)}>Cancel</Button>
              <Button
                disabled={!paidForm.amount || !paidForm.planTier || loading === markPaidShop?.id + "mark_paid"}
                onClick={handleMarkPaid}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
