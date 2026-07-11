"use client";

import { useState, useEffect, useCallback } from "react";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { toast } from "sonner";
import { Users, Plus, Search, Phone, Mail, CreditCard, Banknote, CheckCircle2, ShoppingBag, Lock, MoreVertical, Pencil, Trash2, MapPin, ChevronRight, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

interface SaleHistoryItem {
  id: string;
  createdAt: string;
  total: number;
  amountPaid: number;
  status: string;
  paymentMethod: string;
  items: { quantity: number; unitPrice: number; lineTotal: number; product: { name: string; unit: string } }[];
}

interface PendingSale {
  id: string;
  createdAt: string;
  total: number;
  amountPaid: number;
  items: { quantity: number; unitPrice: number; lineTotal: number; product: { name: string; unit: string } }[];
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  creditBalance: number;
  totalSpent: number;
  _count: { sales: number };
  createdAt: string;
}

function formatLKR(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;
}

export function CustomersClient() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Add customer dialog
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [saving, setSaving] = useState(false);

  // Edit dialog
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm]         = useState({ name: "", phone: "", email: "", address: "" });
  const [editSaving, setEditSaving]     = useState(false);

  // Delete dialog
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null);
  const [deleting, setDeleting]             = useState(false);

  // Profile sheet
  const [profileCustomer, setProfileCustomer] = useState<Customer | null>(null);
  const [profileSales, setProfileSales] = useState<SaleHistoryItem[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!profileCustomer) { setProfileSales([]); return; }
    setProfileLoading(true);
    fetch(`/api/customers/${profileCustomer.id}?view=profile`)
      .then((r) => r.json())
      .then((d) => {
        const sales: SaleHistoryItem[] = (d.customer?.sales ?? []).map((s: SaleHistoryItem) => ({
          ...s,
          total: Number(s.total),
          amountPaid: Number(s.amountPaid),
          items: s.items.map((i) => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), lineTotal: Number(i.lineTotal) })),
        }));
        setProfileSales(sales);
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [profileCustomer]);

  // Record payment dialog
  const [payCustomer, setPayCustomer] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [planBlocked, setPlanBlocked] = useState(false);

  const fetchCustomers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/customers?${params}`);
      if (res.status === 403) { setPlanBlocked(true); setLoading(false); return; }
      const data = await res.json();
      setCustomers(
        (data.customers ?? []).map((c: Customer) => ({
          ...c,
          creditBalance: Number(c.creditBalance),
          totalSpent: Number(c.totalSpent),
        }))
      );
      setTotal(data.total ?? 0);
    } catch {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, 200);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  useAutoRefresh(useCallback(() => fetchCustomers(true), [fetchCustomers]));

  useEffect(() => {
    if (!payCustomer) { setPendingSales([]); return; }
    setLoadingPending(true);
    fetch(`/api/customers/${payCustomer.id}`)
      .then((r) => r.json())
      .then((d) => {
        const sales: PendingSale[] = (d.customer?.sales ?? []).map((s: PendingSale) => ({
          ...s,
          total: Number(s.total),
          amountPaid: Number(s.amountPaid),
          items: s.items.map((i) => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), lineTotal: Number(i.lineTotal) })),
        }));
        setPendingSales(sales);
      })
      .catch(() => {})
      .finally(() => setLoadingPending(false));
  }, [payCustomer]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to add customer"); return; }
      toast.success("Customer added");
      setAddOpen(false);
      setForm({ name: "", phone: "", email: "", address: "" });
      fetchCustomers();
    } catch {
      toast.error("Failed to add customer");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(c: Customer) {
    setEditCustomer(c);
    setEditForm({ name: c.name, phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "" });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editCustomer || !editForm.name) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/customers/${editCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...editForm }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to update customer"); return; }
      toast.success("Customer updated");
      setEditCustomer(null);
      fetchCustomers();
    } catch {
      toast.error("Failed to update customer");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteCustomer) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${deleteCustomer.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to delete customer"); return; }
      toast.success(`${deleteCustomer.name} deleted`);
      setDeleteCustomer(null);
      fetchCustomers();
    } catch {
      toast.error("Failed to delete customer");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payCustomer) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }

    setPaying(true);
    try {
      const res = await fetch(`/api/customers/${payCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "record_payment", amount }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to record payment"); return; }

      const applied = Number(data.applied);
      const settled = data.settledSales ?? 0;
      toast.success(
        `${formatLKR(applied)} payment recorded for ${payCustomer.name}` +
        (settled > 0 ? ` · ${settled} sale${settled !== 1 ? "s" : ""} fully settled` : "")
      );
      setPayCustomer(null);
      setPayAmount("");
      fetchCustomers();
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setPaying(false);
    }
  }

  const totalOutstanding = customers.reduce((s, c) => s + c.creditBalance, 0);

  if (planBlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
          <Lock className="h-7 w-7 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Customer management requires Standard plan</h2>
        <p className="text-muted-foreground max-w-sm">Upgrade your plan to track customers, manage credit balances, and view purchase history.</p>
        <a href="/settings" className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">
          Upgrade plan in Settings
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description={`${total} customer${total !== 1 ? "s" : ""}`}
        action={
          <Button onClick={() => setAddOpen(true)} className="font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        }
      />

      {/* Outstanding credit summary banner */}
      {totalOutstanding > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <CreditCard className="h-5 w-5 text-destructive flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              {formatLKR(totalOutstanding)} total credit outstanding
            </p>
            <p className="text-xs text-muted-foreground">
              Across {customers.filter((c) => c.creditBalance > 0).length} customer{customers.filter((c) => c.creditBalance > 0).length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Add your first customer to track purchase history and manage credit accounts."
          action={{ label: "Add Customer", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => (
            <Card key={c.id} className="shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer" onClick={() => setProfileCustomer(c)}>
              {/* Red top stripe if they owe money */}
              {c.creditBalance > 0 && (
                <div className="h-0.5 bg-gradient-to-r from-destructive/60 to-destructive/10" />
              )}
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="font-semibold text-foreground">{c.name}</p>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                    </div>
                    {c.phone && (
                      <p className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        {c.phone}
                      </p>
                    )}
                    {c.email && (
                      <p className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5 truncate">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {c.creditBalance > 0 && (
                      <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                        Owes
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openEdit(c)} className="gap-2">
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteCustomer(c)}
                          className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Purchases</p>
                    <p className="text-sm font-semibold">{c._count.sales}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Total Spent</p>
                    <p className="text-xs font-semibold font-mono truncate">{formatLKR(c.totalSpent)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Credit</p>
                    <p className={`text-xs font-bold font-mono truncate ${c.creditBalance > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {formatLKR(c.creditBalance)}
                    </p>
                  </div>
                </div>

                {/* Record Payment button — only shown when there's outstanding credit */}
                {c.creditBalance > 0 && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-8 border-destructive/30 text-destructive hover:bg-destructive/5 gap-1.5"
                      onClick={() => { setPayCustomer(c); setPayAmount(""); }}
                    >
                      <Banknote className="h-3.5 w-3.5" />
                      Record Payment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Customer dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cname">Name *</Label>
              <Input id="cname" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required placeholder="e.g. Kamal Silva" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cphone">Phone</Label>
              <Input id="cphone" type="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="0771234567" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cemail">Email <span className="text-muted-foreground font-normal text-xs">(for receipts)</span></Label>
              <Input id="cemail" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="customer@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="caddress">Address</Label>
              <Input id="caddress" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Optional" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving} className="font-semibold">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Customer dialog */}
      <Dialog open={!!editCustomer} onOpenChange={(o) => !o && setEditCustomer(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ename">Name *</Label>
              <Input id="ename" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} required placeholder="e.g. Kamal Silva" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ephone">Phone</Label>
              <Input id="ephone" type="tel" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} placeholder="0771234567" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eemail">Email <span className="text-muted-foreground font-normal text-xs">(for receipts)</span></Label>
              <Input id="eemail" type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} placeholder="customer@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eaddress">Address</Label>
              <Input id="eaddress" value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} placeholder="Optional" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setEditCustomer(null)} disabled={editSaving}>Cancel</Button>
              <Button type="submit" disabled={editSaving} className="font-semibold">
                {editSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteCustomer} onOpenChange={(o) => !o && setDeleteCustomer(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              This will permanently remove <span className="font-semibold text-foreground">{deleteCustomer?.name}</span> and all their data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteCustomer && deleteCustomer.creditBalance > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <span className="font-semibold">Warning:</span> This customer has {formatLKR(deleteCustomer.creditBalance)} outstanding credit balance.
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteCustomer(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="font-semibold">
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment dialog */}
      <Dialog open={!!payCustomer} onOpenChange={(o) => !o && setPayCustomer(null)}>
        <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              Record Payment
            </DialogTitle>
          </DialogHeader>

          {payCustomer && (
            <form onSubmit={handleRecordPayment} className="flex flex-col min-h-0 flex-1">
              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Customer info */}
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-1">
                  <p className="text-sm font-semibold text-foreground">{payCustomer.name}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total outstanding</span>
                    <span className="font-bold font-mono text-destructive">
                      {formatLKR(payCustomer.creditBalance)}
                    </span>
                  </div>
                </div>

                {/* Outstanding credit sales */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Unpaid Credit Sales (oldest first)
                  </p>
                  {loadingPending ? (
                    <div className="flex justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : pendingSales.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No outstanding sales found</p>
                  ) : (
                    <div className="rounded-lg border border-border divide-y divide-border">
                      {pendingSales.map((s) => {
                        const due = s.total - s.amountPaid;
                        return (
                          <div key={s.id} className="px-3 py-2.5 flex items-start justify-between text-xs gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-foreground font-medium">
                                {new Date(s.createdAt).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                              <p className="text-muted-foreground mt-0.5 leading-relaxed">
                                {s.items.map((i) => `${i.product.name} ×${Number(i.quantity)}`).join(", ")}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-mono font-bold text-destructive">{formatLKR(due)}</p>
                              {s.amountPaid > 0 && (
                                <p className="font-mono text-[color:var(--brand-success)] text-[11px]">+{formatLKR(s.amountPaid)} paid</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Amount input */}
                <div className="space-y-2">
                  <Label htmlFor="payamt">Amount Received (LKR)</Label>
                  <Input
                    id="payamt"
                    type="number"
                    min={1}
                    max={payCustomer.creditBalance}
                    step={0.01}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder={payCustomer.creditBalance.toFixed(2)}
                    className="font-mono text-lg h-12"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setPayAmount(payCustomer.creditBalance.toFixed(2))}
                  >
                    Pay full amount ({formatLKR(payCustomer.creditBalance)})
                  </button>
                </div>

                {/* Preview */}
                {payAmount && parseFloat(payAmount) > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Current balance</span>
                        <span className="font-mono">{formatLKR(payCustomer.creditBalance)}</span>
                      </div>
                      <div className="flex justify-between text-primary">
                        <span>Payment received</span>
                        <span className="font-mono">− {formatLKR(Math.min(parseFloat(payAmount), payCustomer.creditBalance))}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1.5">
                        <span>Remaining balance</span>
                        <span className={`font-mono ${Math.max(0, payCustomer.creditBalance - parseFloat(payAmount)) === 0 ? "text-[color:var(--brand-success)]" : "text-destructive"}`}>
                          {formatLKR(Math.max(0, payCustomer.creditBalance - parseFloat(payAmount)))}
                        </span>
                      </div>
                      {Math.max(0, payCustomer.creditBalance - parseFloat(payAmount)) === 0 && (
                        <div className="flex items-center gap-1.5 text-[color:var(--brand-success)] text-xs font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Account will be fully settled
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Footer — always visible */}
              <div className="flex-shrink-0 pt-4 border-t border-border mt-4">
                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={() => setPayCustomer(null)} disabled={paying}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={paying || !payAmount || parseFloat(payAmount) <= 0} className="font-semibold">
                    {paying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Confirm Payment
                  </Button>
                </DialogFooter>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Customer Profile Sheet ─────────────────────────────────────────── */}
      <Sheet open={!!profileCustomer} onOpenChange={(o) => !o && setProfileCustomer(null)}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
          {profileCustomer && (
            <>
              <SheetHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
                <SheetTitle className="text-lg">{profileCustomer.name}</SheetTitle>
                <div className="space-y-1 mt-1">
                  {profileCustomer.phone && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                      {profileCustomer.phone}
                    </p>
                  )}
                  {profileCustomer.email && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                      {profileCustomer.email}
                    </p>
                  )}
                  {profileCustomer.address && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                      {profileCustomer.address}
                    </p>
                  )}
                </div>
              </SheetHeader>

              {/* Stats strip */}
              <div className="grid grid-cols-3 divide-x divide-border border-b border-border flex-shrink-0">
                {[
                  { label: "Total Spent",  value: formatLKR(profileCustomer.totalSpent) },
                  { label: "Purchases",    value: profileCustomer._count.sales.toString() },
                  { label: "Credit Owed",  value: formatLKR(profileCustomer.creditBalance) },
                ].map(({ label, value }) => (
                  <div key={label} className="py-3 px-4 text-center">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-sm font-bold font-mono mt-0.5 ${label === "Credit Owed" && profileCustomer.creditBalance > 0 ? "text-destructive" : "text-foreground"}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-border flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1.5"
                  onClick={() => { setEditCustomer(profileCustomer); setEditForm({ name: profileCustomer.name, phone: profileCustomer.phone ?? "", email: profileCustomer.email ?? "", address: profileCustomer.address ?? "" }); }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                {profileCustomer.creditBalance > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
                    onClick={() => { setPayCustomer(profileCustomer); setPayAmount(""); }}
                  >
                    <Banknote className="h-3.5 w-3.5" /> Record Payment
                  </Button>
                )}
                {profileCustomer.creditBalance > 0 && profileCustomer.phone && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5 border-green-500/30 text-green-600 hover:bg-green-500/5"
                    onClick={() => {
                      const phone = profileCustomer.phone!.replace(/\D/g, "");
                      const intlPhone = phone.startsWith("0") ? `94${phone.slice(1)}` : phone;
                      const msg = `Hi ${profileCustomer.name}, this is a friendly reminder that you have an outstanding credit balance of LKR ${Number(profileCustomer.creditBalance).toLocaleString("en-LK", { minimumFractionDigits: 2 })} with us. Please visit us at your earliest convenience to settle the amount. Thank you!`;
                      window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, "_blank");
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> WhatsApp Reminder
                  </Button>
                )}
              </div>

              {/* Purchase history */}
              <div className="flex-1 overflow-y-auto">
                <p className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                  Purchase History
                </p>

                {profileLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : profileSales.length === 0 ? (
                  <div className="flex flex-col items-center py-12 gap-2 text-muted-foreground">
                    <ShoppingBag className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No purchases yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {profileSales.map((sale) => {
                      const STATUS_STYLES: Record<string, string> = {
                        COMPLETED:       "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                        PENDING_PAYMENT: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
                        EXCHANGED:       "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
                        VOIDED:          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                        REFUNDED:        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
                      };
                      const STATUS_LABELS: Record<string, string> = {
                        COMPLETED: "Completed", PENDING_PAYMENT: "Awaiting Payment",
                        EXCHANGED: "Exchanged", VOIDED: "Voided", REFUNDED: "Refunded",
                      };
                      const METHOD_LABELS: Record<string, string> = {
                        CASH: "Cash", CARD: "Card", ONLINE: "Online", CREDIT: "Credit",
                      };
                      return (
                        <div key={sale.id} className="px-6 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">
                                {new Date(sale.createdAt).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod}
                                {" · "}#{sale.id.slice(-6).toUpperCase()}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                {sale.items.map((i) => `${i.product.name} ×${Number(i.quantity)}`).join(", ")}
                              </p>
                              {sale.status === "PENDING_PAYMENT" && (
                                <p className="text-xs text-destructive font-medium mt-1">
                                  Due: {formatLKR(sale.total - sale.amountPaid)}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                              <p className="text-sm font-bold font-mono text-foreground">{formatLKR(sale.total)}</p>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[sale.status] ?? ""}`}>
                                {STATUS_LABELS[sale.status] ?? sale.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
