"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import {
  CheckCircle, Lock, Unlock, RefreshCcw, Loader2,
  Users, TrendingUp, Clock, ShieldAlert, MessageSquare,
  MoreVertical, Trash2, Plus, WifiOff, Play, Receipt, Mail, Wrench, Infinity, Search,
  CalendarClock, AlertTriangle, CreditCard,
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
  email: string | null;
  category: string;
  planTier: PlanTier;
  billingStatus: BillingStatus;
  trialEndsAt: Date | null;
  gracePeriodEndsAt: Date | null;
  nextBillingDate: Date | null;
  createdAt: Date;
  payments: Array<{ paidAt: Date; amount: number; billingMonth: string; planTier: string; reference: string | null; note: string | null }>;
  _count: { sales: number };
  productsCount: number;
  servicesCount: number;
  smsAddonEnabled: boolean;
  smsBalance: number;
  emailLowStock: boolean;
  emailDailySummary: boolean;
  emailReceiptEnabled: boolean;
  cardSurchargeEnabled: boolean;
  maintenanceBanner: boolean;
  maintenanceBannerMessage: string | null;
  branchModeEnabled: boolean;
  deviceLockEnabled: boolean;
  isLifetime: boolean;
  maintenanceDueDate: string | null;
  maintenancePaidUntil: string | null;
  maintenancePayments: Array<{
    id: string;
    amount: number;
    method: string;
    reference: string | null;
    note: string | null;
    periodStart: string;
    periodEnd: string;
    paidAt: string;
  }>;
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
  const end = new Date(d);
  end.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((end.getTime() - today.getTime()) / 86_400_000));
}

const MAINTENANCE_PRESETS = [5000, 7500, 10000];
const MAINTENANCE_GRACE_DAYS = 30;

type MaintenanceUrgency = "free" | "paid" | "upcoming" | "due" | "overdue";

function getMaintenanceStatus(shop: Shop): {
  urgency: MaintenanceUrgency;
  label: string;
  className: string;
} | null {
  if (!shop.isLifetime) return null;

  const now = new Date();

  // Currently paid
  if (shop.maintenancePaidUntil) {
    const paidUntil = new Date(shop.maintenancePaidUntil);
    if (paidUntil > now) {
      const days = Math.round((paidUntil.getTime() - now.getTime()) / 86_400_000);
      if (days > 60) return { urgency: "paid", label: `Maint. paid · ${fmt(paidUntil)}`, className: "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20" };
      return { urgency: "upcoming", label: `Maint. expires in ${days}d`, className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20" };
    }
  }

  // No due date set → still in free period (admin hasn't configured yet)
  if (!shop.maintenanceDueDate) {
    return { urgency: "free", label: "Maint. free period", className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20" };
  }

  const dueDate = new Date(shop.maintenanceDueDate);

  // Due date in future → free period / upcoming
  if (dueDate > now) {
    const days = Math.round((dueDate.getTime() - now.getTime()) / 86_400_000);
    if (days > 60) return { urgency: "free", label: `Maint. free · ${fmt(dueDate)}`, className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20" };
    return { urgency: "upcoming", label: `Maint. due in ${days}d`, className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20" };
  }

  // Past due date — check grace period
  const graceEnd = new Date(dueDate.getTime() + MAINTENANCE_GRACE_DAYS * 86_400_000);
  if (graceEnd > now) {
    const days = Math.round((graceEnd.getTime() - now.getTime()) / 86_400_000);
    return { urgency: "due", label: `Maint. due · ${days}d grace`, className: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20" };
  }

  return { urgency: "overdue", label: "Maint. OVERDUE", className: "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20" };
}

const SMS_PRESETS = [500, 1000, 2000, 5000];

export function AdminBillingClient({ shops: initial }: { shops: Shop[] }) {
  const [shops, setShops] = useState<Shop[]>(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
  const [smsBalanceAmount, setSmsBalanceAmount] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [togglingEmail, setTogglingEmail] = useState<string | null>(null);
  const [togglingDeviceLock, setTogglingDeviceLock] = useState<string | null>(null);
  const [togglingCardSurcharge, setTogglingCardSurcharge] = useState<string | null>(null);
  const [testingAlert, setTestingAlert] = useState<string | null>(null);
  const [togglingLifetime, setTogglingLifetime] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Maintenance payment dialogs
  const [maintPayShop, setMaintPayShop] = useState<Shop | null>(null);
  const [maintHistoryShop, setMaintHistoryShop] = useState<Shop | null>(null);
  const [maintPayForm, setMaintPayForm] = useState({ amount: "", method: "MANUAL", reference: "", note: "" });
  const [savingMaintPay, setSavingMaintPay] = useState(false);

  const filteredShops = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.ownerName.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q) ||
      (s.email ?? "").toLowerCase().includes(q) ||
      (CATEGORY_LABELS[s.category] ?? s.category).toLowerCase().includes(q)
    );
  }, [shops, search]);

  // Generic confirm dialog
  type ConfirmAction = {
    title: string;
    description: string;
    confirmLabel: string;
    variant?: "default" | "destructive";
    onConfirm: () => Promise<void>;
  };
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function runConfirm() {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      await confirmAction.onConfirm();
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  }

  // Maintenance — per-shop dialog
  const [maintenanceShop, setMaintenanceShop] = useState<Shop | null>(null);
  const [maintenanceMsg, setMaintenanceMsg]   = useState("");
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  // Maintenance — global dialog
  const [globalMaintenanceOpen, setGlobalMaintenanceOpen] = useState(false);
  const [globalMaintenanceMsg, setGlobalMaintenanceMsg]   = useState("");
  const [globalMaintenanceEnable, setGlobalMaintenanceEnable] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);

  async function handleSetMaintenance(e: React.FormEvent) {
    e.preventDefault();
    if (!maintenanceShop) return;
    setSavingMaintenance(true);
    try {
      await callAdmin(maintenanceShop.id, {
        action: "set_maintenance",
        enabled: true,
        message: maintenanceMsg,
      });
      toast.success(`Maintenance banner enabled for ${maintenanceShop.name}`);
      setMaintenanceShop(null);
      await refresh();
    } catch {
      toast.error("Failed to set maintenance banner");
    } finally {
      setSavingMaintenance(false);
    }
  }

  async function handleDisableMaintenance(shop: Shop) {
    setLoading(shop.id + "maintenance");
    try {
      await callAdmin(shop.id, { action: "set_maintenance", enabled: false });
      toast.success(`Maintenance banner removed for ${shop.name}`);
      await refresh();
    } catch {
      toast.error("Failed to remove maintenance banner");
    } finally {
      setLoading(null);
    }
  }

  async function handleGlobalMaintenance(e: React.FormEvent) {
    e.preventDefault();
    setSavingGlobal(true);
    try {
      const res = await fetch("/api/admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: globalMaintenanceEnable, message: globalMaintenanceMsg }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(
        globalMaintenanceEnable
          ? `Maintenance banner enabled for all ${data.count} shops`
          : `Maintenance banner cleared for all ${data.count} shops`
      );
      setGlobalMaintenanceOpen(false);
      setGlobalMaintenanceMsg("");
      await refresh();
    } catch {
      toast.error("Failed to update global maintenance");
    } finally {
      setSavingGlobal(false);
    }
  }

  async function handleRecordMaintenance() {
    if (!maintPayShop) return;
    const amount = parseFloat(maintPayForm.amount);
    if (!amount || amount <= 0) return;
    setSavingMaintPay(true);
    try {
      const res = await fetch(`/api/admin/shops/${maintPayShop.id}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          method: maintPayForm.method,
          reference: maintPayForm.reference || undefined,
          note: maintPayForm.note || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Maintenance payment of LKR ${amount.toLocaleString()} recorded for ${maintPayShop.name}`);
      setMaintPayShop(null);
      setMaintPayForm({ amount: "", method: "MANUAL", reference: "", note: "" });
      await refresh();
    } catch {
      toast.error("Failed to record maintenance payment");
    } finally {
      setSavingMaintPay(false);
    }
  }

  async function toggleEmailNotifs(shop: Shop, enabled: boolean) {
    setTogglingEmail(shop.id);
    try {
      const res = await fetch("/api/admin/email-prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: shop.id, enabled }),
      });
      if (!res.ok) throw new Error();
      await refresh();
      toast.success(enabled ? "Email notifications enabled" : "Email notifications disabled");
    } catch {
      toast.error("Failed to update email notifications");
    } finally {
      setTogglingEmail(null);
    }
  }

  async function toggleDeviceLock(shop: Shop, enabled: boolean) {
    setTogglingDeviceLock(shop.id);
    try {
      const res = await fetch(`/api/admin/shops/${shop.id}/device-lock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error();
      await refresh();
      toast.success(enabled ? "Device Lock enabled" : "Device Lock disabled");
    } catch {
      toast.error("Failed to update Device Lock");
    } finally {
      setTogglingDeviceLock(null);
    }
  }

  async function toggleCardSurcharge(shop: Shop, enabled: boolean) {
    setTogglingCardSurcharge(shop.id);
    try {
      const res = await fetch(`/api/admin/shops/${shop.id}/card-surcharge`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error();
      await refresh();
      toast.success(enabled ? "Card surcharge add-on enabled" : "Card surcharge add-on disabled");
    } catch {
      toast.error("Failed to update card surcharge setting");
    } finally {
      setTogglingCardSurcharge(null);
    }
  }

  async function sendTestAlert(shop: Shop, type: "low-stock" | "daily-summary") {
    setTestingAlert(shop.id + type);
    try {
      const res = await fetch("/api/admin/test-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, shopId: shop.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to send test alert"); return; }

      const { smsSent, emailSent, log, errors } = data as {
        smsSent: boolean; emailSent: boolean; log: string[]; errors: string[];
      };

      if (errors.length > 0) {
        toast.error(errors[0], { description: log.at(-1) });
      } else if (smsSent || emailSent) {
        toast.success(
          `Test alert sent — ${[smsSent && "SMS", emailSent && "Email"].filter(Boolean).join(" + ")}`,
          { description: log.join(" · ") }
        );
      } else {
        toast.warning("Nothing sent", { description: log.join(" · ") });
      }
    } catch {
      toast.error("Failed to send test alert");
    } finally {
      setTestingAlert(null);
    }
  }

  async function resetPrimaryDevice(shop: Shop) {
    setTogglingDeviceLock(shop.id);
    try {
      const res = await fetch(`/api/admin/shops/${shop.id}/device-lock`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Primary device reset — owner must set a new primary from Settings");
    } catch {
      toast.error("Failed to reset primary device");
    } finally {
      setTogglingDeviceLock(null);
    }
  }

  async function toggleLifetime(shop: Shop, enable: boolean) {
    setTogglingLifetime(shop.id);
    try {
      const res = await fetch(`/api/admin/shops/${shop.id}/lifetime`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable }),
      });
      if (!res.ok) throw new Error();
      await refresh();
      toast.success(enable ? "Lifetime license activated" : "Lifetime license removed — shop will follow monthly billing");
    } catch {
      toast.error("Failed to update lifetime status");
    } finally {
      setTogglingLifetime(null);
    }
  }

  async function callAdmin(shopId: string, body: object) {
    const res = await fetch(`/api/admin/billing/${shopId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  const refresh = useCallback(async (silent = false) => {
    if (silent) setAutoRefreshing(true);
    const res = await fetch("/api/admin/shops");
    if (res.ok) {
      setShops((await res.json()).shops);
      setLastUpdated(new Date());
    }
    if (silent) setAutoRefreshing(false);
  }, []);

  useEffect(() => {
    setLastUpdated(new Date());
    intervalRef.current = setInterval(() => refresh(true), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [refresh]);

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
    const lkrAmount = parseFloat(smsBalanceAmount);
    if (!lkrAmount || lkrAmount <= 0) return;
    setLoading(smsCreditsShop.id + "sms_credits");
    try {
      if (smsEnableMode) {
        const enableRes = await fetch("/api/admin/sms-addon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopId: smsCreditsShop.id, enabled: true }),
        });
        if (!enableRes.ok) throw new Error("Failed to enable SMS add-on");
      }
      const balanceRes = await fetch("/api/admin/sms-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: smsCreditsShop.id, amount: lkrAmount }),
      });
      if (!balanceRes.ok) throw new Error("Failed to add balance");
      toast.success(smsEnableMode
        ? `SMS add-on enabled with Rs. ${lkrAmount.toFixed(2)} for ${smsCreditsShop.name}`
        : `Added Rs. ${lkrAmount.toFixed(2)} SMS balance to ${smsCreditsShop.name}`
      );
      setSmsCreditsShop(null);
      setSmsBalanceAmount("");
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
    total:    shops.length,
    lifetime: shops.filter((s) => s.isLifetime).length,
    active:   shops.filter((s) => s.billingStatus === "ACTIVE" && !s.isLifetime).length,
    trial:    shops.filter((s) => s.billingStatus === "TRIAL").length,
    atRisk:   shops.filter((s) => s.billingStatus === "GRACE" || s.billingStatus === "LOCKED").length,
    maintDue: shops.filter((s) => {
      const ms = getMaintenanceStatus(s);
      return ms && (ms.urgency === "due" || ms.urgency === "overdue" || ms.urgency === "upcoming");
    }).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Billing Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">{shops.length} shop{shops.length !== 1 ? "s" : ""} registered</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
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
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              setGlobalMaintenanceEnable(true);
              setGlobalMaintenanceMsg("");
              setGlobalMaintenanceOpen(true);
            }}
          >
            <Wrench className="h-4 w-4" />
            Maintenance
          </Button>
          <div className="flex items-center gap-2">
            {autoRefreshing && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Updating…
              </span>
            )}
            {!autoRefreshing && lastUpdated && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                Updated {lastUpdated.toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
            <Button variant="outline" size="sm" className="gap-2"
              onClick={async () => { await refresh(); toast.success("Refreshed"); }}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Shops",    count: summary.total,    icon: Users,         color: "text-primary",                                  bg: "bg-primary/10" },
          { label: "Lifetime",       count: summary.lifetime, icon: Infinity,      color: "text-yellow-600 dark:text-yellow-400",          bg: "bg-yellow-500/10" },
          { label: "Active",         count: summary.active,   icon: TrendingUp,    color: "text-green-600 dark:text-green-400",            bg: "bg-green-500/10" },
          { label: "Trial",          count: summary.trial,    icon: Clock,         color: "text-blue-600 dark:text-blue-400",              bg: "bg-blue-500/10" },
          { label: "Grace / Locked", count: summary.atRisk,   icon: ShieldAlert,   color: "text-red-600 dark:text-red-400",               bg: "bg-red-500/10" },
          { label: "Maint. Due",     count: summary.maintDue, icon: CalendarClock, color: "text-orange-600 dark:text-orange-400",          bg: "bg-orange-500/10" },
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4">
            <CardTitle className="text-base font-semibold">
              All Shops
              {search && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  — {filteredShops.length} of {shops.length} shown
                </span>
              )}
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, owner, phone…"
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
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
              {filteredShops.map((shop) => {
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
                      {shop.email && (
                        <p className="text-xs text-muted-foreground">{shop.email}</p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{CATEGORY_LABELS[shop.category] ?? shop.category}</p>
                      <p className="text-xs text-muted-foreground/50 mt-0.5">Since {fmt(shop.createdAt)}</p>
                    </td>

                    {/* Plan & SMS */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${plan.className}`}>
                        {plan.label} · {plan.price}
                      </span>
                      <div className="mt-1.5 flex flex-col gap-0.5">
                        {shop.smsAddonEnabled ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                            <MessageSquare className="h-3 w-3" />
                            SMS · Rs. {Number(shop.smsBalance).toFixed(2)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <WifiOff className="h-3 w-3" />
                            SMS off
                          </span>
                        )}
                        {(shop.emailLowStock || shop.emailDailySummary || shop.emailReceiptEnabled) ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                            <Mail className="h-3 w-3" />
                            Email on
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            Email off
                          </span>
                        )}
                        {shop.deviceLockEnabled && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                            <Lock className="h-3 w-3" />
                            Device Lock
                          </span>
                        )}
                        {shop.cardSurchargeEnabled ? (
                          <span className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium">
                            <CreditCard className="h-3 w-3" />
                            Card Surcharge
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <CreditCard className="h-3 w-3" />
                            Card surcharge off
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      {shop.isLifetime ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/25">
                          <Infinity className="h-3 w-3" /> Lifetime
                        </span>
                      ) : (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                      )}
                      {!shop.isLifetime && dl !== null && (
                        <p className={`text-xs mt-1 font-medium ${dl <= 3 ? "text-red-500" : "text-muted-foreground"}`}>
                          {dl > 0 ? `${dl}d left` : "Expired"}
                        </p>
                      )}
                      {shop.isLifetime && (() => {
                        const ms = getMaintenanceStatus(shop);
                        if (!ms) return null;
                        return (
                          <span className={`inline-flex items-center gap-1 mt-1 rounded-full px-2 py-0.5 text-xs font-semibold ${ms.className}`}>
                            {ms.urgency === "overdue" ? <AlertTriangle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
                            {ms.label}
                          </span>
                        );
                      })()}
                      {shop.maintenanceBanner && (
                        <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                          <Wrench className="h-3 w-3" />
                          Maintenance
                        </span>
                      )}
                    </td>

                    {/* Key date */}
                    <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      {shop.isLifetime ? (
                        shop.maintenanceDueDate ? (
                          <span>Maint. due {fmt(shop.maintenanceDueDate)}</span>
                        ) : "—"
                      ) : keyDate}
                    </td>

                    {/* Activity */}
                    <td className="px-4 py-3.5">
                      <p className="text-xs font-medium text-foreground">{shop._count.sales} sales</p>
                      <p className="text-xs text-muted-foreground">{shop.productsCount} products · {shop.servicesCount} services</p>
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
                            const tier = (["BASIC","STANDARD","PREMIUM"].includes(shop.planTier) ? shop.planTier : "STANDARD") as PlanTier;
                            setPaidForm({
                              amount: PLAN_CONFIG[tier].price.replace(/\D/g, ""),
                              planTier: tier,
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
                                <DropdownMenuItem onClick={() => { setSmsCreditsShop(shop); setSmsBalanceAmount(""); }} className="gap-2">
                                  <Plus className="h-3.5 w-3.5" />
                                  Add SMS balance
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem onClick={() => { setSmsCreditsShop(shop); setSmsBalanceAmount(""); setSmsEnableMode(true); }} className="gap-2">
                                <MessageSquare className="h-3.5 w-3.5" />
                                Enable SMS add-on
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            {/* Email notifications toggle */}
                            {(shop.emailLowStock || shop.emailDailySummary || shop.emailReceiptEnabled) ? (
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({
                                  title: "Disable Email Notifications",
                                  description: `Disable all email notifications for ${shop.name}? Low stock alerts, daily summaries, and customer email receipts will stop sending.`,
                                  confirmLabel: "Disable Emails",
                                  variant: "destructive",
                                  onConfirm: () => toggleEmailNotifs(shop, false),
                                })}
                                disabled={togglingEmail === shop.id}
                                className="gap-2 text-amber-600 dark:text-amber-400 focus:text-amber-600"
                              >
                                <Mail className="h-3.5 w-3.5" />
                                Disable email notifications
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({
                                  title: "Enable Email Notifications",
                                  description: `Enable email notifications for ${shop.name}? Low stock alerts, daily summaries, and customer receipts will be sent to their registered email address.`,
                                  confirmLabel: "Enable Emails",
                                  onConfirm: () => toggleEmailNotifs(shop, true),
                                })}
                                disabled={togglingEmail === shop.id}
                                className="gap-2"
                              >
                                <Mail className="h-3.5 w-3.5" />
                                Enable email notifications
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            {/* Test alert triggers */}
                            <DropdownMenuItem
                              onClick={() => sendTestAlert(shop, "low-stock")}
                              disabled={!!testingAlert}
                              className="gap-2"
                            >
                              {testingAlert === shop.id + "low-stock"
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Play className="h-3.5 w-3.5" />}
                              Test low stock alert
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => sendTestAlert(shop, "daily-summary")}
                              disabled={!!testingAlert}
                              className="gap-2"
                            >
                              {testingAlert === shop.id + "daily-summary"
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Play className="h-3.5 w-3.5" />}
                              Test daily summary
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Device Lock toggle */}
                            {shop.deviceLockEnabled ? (
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({
                                  title: "Disable Device Lock",
                                  description: `Disable Device Lock for ${shop.name}? All registered devices will regain full access and the primary device assignment will be cleared.`,
                                  confirmLabel: "Disable Device Lock",
                                  variant: "destructive",
                                  onConfirm: () => toggleDeviceLock(shop, false),
                                })}
                                disabled={togglingDeviceLock === shop.id}
                                className="gap-2 text-amber-600 dark:text-amber-400 focus:text-amber-600"
                              >
                                <Lock className="h-3.5 w-3.5" />
                                Disable Device Lock
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({
                                  title: "Enable Device Lock",
                                  description: `Enable Device Lock for ${shop.name}? The owner must set a primary device from Settings. Only the primary device will have full dashboard access — others are restricted to POS only.`,
                                  confirmLabel: "Enable Device Lock",
                                  onConfirm: () => toggleDeviceLock(shop, true),
                                })}
                                disabled={togglingDeviceLock === shop.id}
                                className="gap-2"
                              >
                                <Lock className="h-3.5 w-3.5" />
                                Enable Device Lock
                              </DropdownMenuItem>
                            )}
                            {shop.deviceLockEnabled && (
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({
                                  title: "Reset Primary Device",
                                  description: `Reset the primary device for ${shop.name}? No device will have primary access until the owner sets a new one from Settings. Use this only if the primary device is lost or unavailable.`,
                                  confirmLabel: "Reset Primary Device",
                                  variant: "destructive",
                                  onConfirm: () => resetPrimaryDevice(shop),
                                })}
                                disabled={togglingDeviceLock === shop.id}
                                className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Lock className="h-3.5 w-3.5" />
                                Reset Primary Device
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            {/* Card surcharge toggle */}
                            {shop.cardSurchargeEnabled ? (
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({
                                  title: "Disable Card Surcharge Add-on",
                                  description: `Disable card surcharge for ${shop.name}? The surcharge rate setting will be hidden from the shop owner and fees will no longer be recorded on card sales.`,
                                  confirmLabel: "Disable",
                                  variant: "destructive",
                                  onConfirm: () => toggleCardSurcharge(shop, false),
                                })}
                                disabled={togglingCardSurcharge === shop.id}
                                className="gap-2 text-amber-600 dark:text-amber-400 focus:text-amber-600"
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                Disable card surcharge
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({
                                  title: "Enable Card Surcharge Add-on",
                                  description: `Enable card surcharge for ${shop.name}? The shop owner can then configure their bank's processing fee rate in Settings. The fee is absorbed by the business and recorded for P&L reporting.`,
                                  confirmLabel: "Enable",
                                  onConfirm: () => toggleCardSurcharge(shop, true),
                                })}
                                disabled={togglingCardSurcharge === shop.id}
                                className="gap-2"
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                Enable card surcharge
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            {/* Maintenance payment — only for lifetime shops */}
                            {shop.isLifetime && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setMaintPayForm({ amount: "7500", method: "MANUAL", reference: "", note: "" });
                                    setMaintPayShop(shop);
                                  }}
                                  className="gap-2"
                                >
                                  <CalendarClock className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                  Record Maintenance Payment
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setMaintHistoryShop(shop)}
                                  className="gap-2"
                                >
                                  <Receipt className="h-3.5 w-3.5" />
                                  Maintenance History
                                </DropdownMenuItem>
                              </>
                            )}

                            <DropdownMenuSeparator />

                            {/* Lifetime license */}
                            {shop.isLifetime ? (
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({
                                  title: "Remove Lifetime License",
                                  description: `Remove the lifetime license for ${shop.name}? The shop will revert to a 7-day trial period and will need to subscribe to a monthly plan.`,
                                  confirmLabel: "Remove Lifetime License",
                                  variant: "destructive",
                                  onConfirm: () => toggleLifetime(shop, false),
                                })}
                                disabled={togglingLifetime === shop.id}
                                className="gap-2 text-amber-600 dark:text-amber-400 focus:text-amber-600"
                              >
                                <Infinity className="h-3.5 w-3.5" />
                                Remove Lifetime License
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({
                                  title: "Mark as Lifetime License",
                                  description: `Grant a lifetime license to ${shop.name}? This shop will never be billed again and will always have full access. Make sure payment has been recorded first.`,
                                  confirmLabel: "Grant Lifetime License",
                                  onConfirm: () => toggleLifetime(shop, true),
                                })}
                                disabled={togglingLifetime === shop.id}
                                className="gap-2"
                              >
                                <Infinity className="h-3.5 w-3.5" />
                                Mark as Lifetime License
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            {/* Maintenance banner */}
                            {shop.maintenanceBanner ? (
                              <DropdownMenuItem
                                onClick={() => handleDisableMaintenance(shop)}
                                className="gap-2"
                              >
                                <Wrench className="h-3.5 w-3.5 text-blue-500" />
                                Remove maintenance banner
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => { setMaintenanceShop(shop); setMaintenanceMsg(""); }}
                                className="gap-2"
                              >
                                <Wrench className="h-3.5 w-3.5 text-blue-500" />
                                Set maintenance banner
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

              {filteredShops.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-sm text-muted-foreground">
                    {search ? `No shops match "${search}"` : "No shops registered yet."}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Amount (LKR)</Label>
                <Input type="number" value={paidForm.amount} className="h-10"
                  onChange={(e) => setPaidForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="8000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Billing Period</Label>
                <div className="flex rounded-md border border-border overflow-hidden h-10">
                  <button
                    type="button"
                    onClick={() => setPaidForm((p) => ({ ...p, billingMonth: new Date().toISOString().slice(0, 7) }))}
                    className={`flex-1 text-xs font-medium transition-colors px-2 ${
                      paidForm.billingMonth !== "LIFETIME"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaidForm((p) => ({ ...p, billingMonth: "LIFETIME" }))}
                    className={`flex-1 text-xs font-medium transition-colors px-2 border-l border-border ${
                      paidForm.billingMonth === "LIFETIME"
                        ? "bg-yellow-500 text-white"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Lifetime
                  </button>
                </div>
                {paidForm.billingMonth !== "LIFETIME" && (
                  <Input type="month" value={paidForm.billingMonth} className="h-10 mt-1.5"
                    onChange={(e) => setPaidForm((p) => ({ ...p, billingMonth: e.target.value }))} />
                )}
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
      <Dialog open={!!smsCreditsShop} onOpenChange={(o) => { if (!o) { setSmsCreditsShop(null); setSmsBalanceAmount(""); setSmsEnableMode(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {smsEnableMode ? "Enable SMS Add-on" : "Add SMS Credits"}
            </DialogTitle>
          </DialogHeader>
          {smsEnableMode && (
            <p className="text-sm text-muted-foreground -mt-1">
              Set the opening LKR balance for <span className="font-semibold text-foreground">{smsCreditsShop?.name}</span>. SMS will activate immediately.
            </p>
          )}
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{smsCreditsShop?.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Current balance</p>
              </div>
              <span className="text-2xl font-bold text-foreground tabular-nums">Rs. {Number(smsCreditsShop?.smsBalance ?? 0).toFixed(2)}</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Amount to add (LKR)</Label>
              <div className="flex gap-2 flex-wrap">
                {SMS_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setSmsBalanceAmount(String(preset))}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                      smsBalanceAmount === String(preset)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border bg-card hover:bg-muted text-foreground"
                    }`}
                  >
                    Rs. {preset.toLocaleString()}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={smsBalanceAmount}
                onChange={(e) => setSmsBalanceAmount(e.target.value)}
                placeholder="Or enter custom LKR amount"
                className="h-10 mt-2"
              />
            </div>

            {smsBalanceAmount && parseFloat(smsBalanceAmount) > 0 && (
              <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary">
                New balance will be <span className="font-bold">Rs. {(Number(smsCreditsShop?.smsBalance ?? 0) + parseFloat(smsBalanceAmount)).toFixed(2)}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSmsCreditsShop(null); setSmsBalanceAmount(""); }}>Cancel</Button>
            <Button
              disabled={!smsBalanceAmount || parseFloat(smsBalanceAmount) <= 0 || loading === smsCreditsShop?.id + "sms_credits"}
              onClick={handleAddCredits} className="gap-2"
            >
              {loading === smsCreditsShop?.id + "sms_credits"
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Plus className="h-4 w-4" />}
              {smsEnableMode ? "Enable & Add Balance" : "Add Balance"}
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
              <p>• Remaining balance (Rs. {Number(smsDisableShop?.smsBalance ?? 0).toFixed(2)}) is preserved and restored if re-enabled</p>
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
              <p>• {deleteShop?.productsCount ?? 0} products · {deleteShop?.servicesCount ?? 0} services</p>
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

      {/* ── Generic confirm dialog ── */}
      <Dialog open={!!confirmAction} onOpenChange={(o) => { if (!o && !confirmLoading) setConfirmAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmAction?.variant === "destructive"
                ? <ShieldAlert className="h-5 w-5 text-destructive" />
                : <CheckCircle className="h-5 w-5 text-primary" />}
              {confirmAction?.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmAction?.description}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={confirmLoading}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.variant === "destructive" ? "outline" : "default"}
              className={confirmAction?.variant === "destructive"
                ? "gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                : "gap-2"}
              onClick={runConfirm}
              disabled={confirmLoading}
            >
              {confirmLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmAction?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-shop maintenance dialog */}
      <Dialog open={!!maintenanceShop} onOpenChange={(o) => !o && setMaintenanceShop(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-500" />
              Set Maintenance Banner
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSetMaintenance} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A banner will be shown to <span className="font-semibold text-foreground">{maintenanceShop?.name}</span> on every page until removed.
            </p>
            <div className="space-y-2">
              <Label htmlFor="maint-msg">Custom message <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input
                id="maint-msg"
                value={maintenanceMsg}
                onChange={(e) => setMaintenanceMsg(e.target.value)}
                placeholder="System maintenance in progress…"
              />
              <p className="text-xs text-muted-foreground">Leave blank to use the default message.</p>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setMaintenanceShop(null)} disabled={savingMaintenance}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingMaintenance} className="gap-2">
                {savingMaintenance && <Loader2 className="h-4 w-4 animate-spin" />}
                Enable Banner
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Record Maintenance Payment dialog ── */}
      <Dialog open={!!maintPayShop} onOpenChange={(o) => !o && setMaintPayShop(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-green-600 dark:text-green-400" />
              Record Maintenance Payment
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Annual maintenance for <span className="font-semibold text-foreground">{maintPayShop?.name}</span>.
            Access will be renewed for 1 year from today.
          </p>
          {maintPayShop && (() => {
            const ms = getMaintenanceStatus(maintPayShop);
            if (ms && (ms.urgency === "due" || ms.urgency === "overdue")) {
              return (
                <div className="flex items-start gap-2 rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 px-3 py-2.5 text-xs text-orange-700 dark:text-orange-400">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>{ms.urgency === "overdue" ? "Maintenance is overdue." : "Maintenance payment is due."} Record payment to extend access by 1 year.</span>
                </div>
              );
            }
            return null;
          })()}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Amount (LKR)</Label>
              <div className="flex gap-2 flex-wrap">
                {MAINTENANCE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMaintPayForm((f) => ({ ...f, amount: String(preset) }))}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                      maintPayForm.amount === String(preset)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border bg-card hover:bg-muted text-foreground"
                    }`}
                  >
                    LKR {preset.toLocaleString()}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                min="1"
                value={maintPayForm.amount}
                onChange={(e) => setMaintPayForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="Or enter custom amount"
                className="h-10 mt-2"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Payment Method</Label>
              <Select value={maintPayForm.method} onValueChange={(v) => setMaintPayForm((f) => ({ ...f, method: v ?? "MANUAL" }))}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="w-max min-w-(--anchor-width)">
                  <SelectItem value="MANUAL">Manual / Cash</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="ONLINE">Online Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Reference <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={maintPayForm.reference}
                onChange={(e) => setMaintPayForm((f) => ({ ...f, reference: e.target.value }))}
                placeholder="Bank ref, receipt number…"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={maintPayForm.note}
                onChange={(e) => setMaintPayForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Any additional notes…"
                className="h-10"
              />
            </div>
            {maintPayForm.amount && parseFloat(maintPayForm.amount) > 0 && (
              <div className="rounded-md bg-green-500/5 border border-green-500/20 px-3 py-2 text-xs text-green-700 dark:text-green-400">
                Maintenance will be active until <span className="font-bold">{fmt(new Date(Date.now() + 365 * 86_400_000))}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintPayShop(null)}>Cancel</Button>
            <Button
              disabled={!maintPayForm.amount || parseFloat(maintPayForm.amount) <= 0 || savingMaintPay}
              onClick={handleRecordMaintenance}
              className="gap-2"
            >
              {savingMaintPay ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Maintenance History dialog ── */}
      <Dialog open={!!maintHistoryShop} onOpenChange={(o) => !o && setMaintHistoryShop(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Maintenance History — {maintHistoryShop?.name}
            </DialogTitle>
          </DialogHeader>
          {maintHistoryShop && (() => {
            const ms = getMaintenanceStatus(maintHistoryShop);
            return ms ? (
              <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold w-fit ${ms.className}`}>
                <CalendarClock className="h-3.5 w-3.5" />
                Current status: {ms.label}
              </div>
            ) : null;
          })()}
          {(maintHistoryShop?.maintenancePayments.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No maintenance payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    {["Period", "Amount", "Method", "Paid On", "Reference / Note"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {maintHistoryShop?.maintenancePayments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {fmt(p.periodStart)} → {fmt(p.periodEnd)}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">LKR {p.amount.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap capitalize">{p.method.replace("_", " ").toLowerCase()}</td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmt(p.paidAt)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {p.reference || p.note
                          ? <span title={[p.reference, p.note].filter(Boolean).join(" — ")}>{p.reference ?? p.note}</span>
                          : <span className="text-muted-foreground/50">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-between items-center pt-1 text-xs text-muted-foreground">
            <span>{maintHistoryShop?.maintenancePayments.length ?? 0} payment{(maintHistoryShop?.maintenancePayments.length ?? 0) !== 1 ? "s" : ""} total</span>
            <span>Total collected: LKR {(maintHistoryShop?.maintenancePayments.reduce((s, p) => s + p.amount, 0) ?? 0).toLocaleString()}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintHistoryShop(null)}>Close</Button>
            <Button
              className="gap-2"
              onClick={() => { setMaintHistoryShop(null); setMaintPayForm({ amount: "7500", method: "MANUAL", reference: "", note: "" }); setMaintPayShop(maintHistoryShop); }}
            >
              <CalendarClock className="h-4 w-4" />
              Record New Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global maintenance dialog */}
      <Dialog open={globalMaintenanceOpen} onOpenChange={(o) => { if (!o) { setGlobalMaintenanceOpen(false); setGlobalMaintenanceMsg(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-500" />
              Global Maintenance Banner
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGlobalMaintenance} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will update the maintenance banner for <span className="font-semibold text-foreground">all {shops.length} shops</span> at once.
            </p>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setGlobalMaintenanceEnable(true)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${globalMaintenanceEnable ? "bg-blue-500 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                Enable all
              </button>
              <button
                type="button"
                onClick={() => setGlobalMaintenanceEnable(false)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${!globalMaintenanceEnable ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                Clear all
              </button>
            </div>
            {globalMaintenanceEnable && (
              <div className="space-y-2">
                <Label htmlFor="global-msg">Custom message <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <Input
                  id="global-msg"
                  value={globalMaintenanceMsg}
                  onChange={(e) => setGlobalMaintenanceMsg(e.target.value)}
                  placeholder="System maintenance in progress…"
                />
                <p className="text-xs text-muted-foreground">Leave blank to use the default message.</p>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setGlobalMaintenanceOpen(false)} disabled={savingGlobal}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingGlobal}
                className="gap-2"
                variant={globalMaintenanceEnable ? "default" : "outline"}
              >
                {savingGlobal && <Loader2 className="h-4 w-4 animate-spin" />}
                {globalMaintenanceEnable ? "Enable for all shops" : "Clear from all shops"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
