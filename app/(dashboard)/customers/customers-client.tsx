"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Users, Plus, Search, Phone, CreditCard, Banknote, CheckCircle2, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

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
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);

  // Record payment dialog
  const [payCustomer, setPayCustomer] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/customers?${params}`);
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
      setForm({ name: "", phone: "", address: "" });
      fetchCustomers();
    } catch {
      toast.error("Failed to add customer");
    } finally {
      setSaving(false);
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
            <Card key={c.id} className="shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              {/* Red top stripe if they owe money */}
              {c.creditBalance > 0 && (
                <div className="h-0.5 bg-gradient-to-r from-destructive/60 to-destructive/10" />
              )}
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{c.name}</p>
                    {c.phone && (
                      <p className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </p>
                    )}
                  </div>
                  {c.creditBalance > 0 && (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20 flex-shrink-0">
                      Owes
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Purchases</p>
                    <p className="text-sm font-semibold">{c._count.sales}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Spent</p>
                    <p className="text-sm font-semibold font-mono">{formatLKR(c.totalSpent)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Credit</p>
                    <p className={`text-sm font-bold font-mono ${c.creditBalance > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {formatLKR(c.creditBalance)}
                    </p>
                  </div>
                </div>

                {/* Record Payment button — only shown when there's outstanding credit */}
                {c.creditBalance > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-8 border-destructive/30 text-destructive hover:bg-destructive/5 gap-1.5"
                    onClick={() => { setPayCustomer(c); setPayAmount(""); }}
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    Record Payment
                  </Button>
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
    </div>
  );
}
