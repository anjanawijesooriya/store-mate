"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Receipt,
  ChevronDown,
  ChevronUp,
  XCircle,
  RotateCcw,
  Loader2,
  ArrowLeftRight,
  Plus,
  Minus,
  Trash2,
  Search,
  CornerDownRight,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SaleItem {
  id: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  returned: boolean;
  product: { name: string; unit: string };
}

interface Sale {
  id: string;
  total: number;
  subtotal: number;
  discount: number;
  amountPaid: number;
  paymentMethod: string;
  status: "COMPLETED" | "PENDING_PAYMENT" | "EXCHANGED" | "VOIDED" | "REFUNDED";
  createdAt: string;
  originalSaleId: string | null;
  items: SaleItem[];
  customer: { id: string; name: string; phone: string | null } | null;
}

interface Product {
  id: string;
  name: string;
  unit: string;
  sellPrice: number;
  stockQty: number;
}

interface NewExchangeItem {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<Sale["status"], string> = {
  COMPLETED:       "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  PENDING_PAYMENT: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  EXCHANGED:       "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  VOIDED:          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  REFUNDED:        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

const STATUS_LABELS: Record<Sale["status"], string> = {
  COMPLETED:       "Completed",
  PENDING_PAYMENT: "Awaiting Payment",
  EXCHANGED:       "Exchanged",
  VOIDED:          "Voided",
  REFUNDED:        "Refunded",
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash", CARD: "Card", ONLINE: "Online", CREDIT: "Credit",
};

const PERIODS = [
  { value: "today",   label: "Today" },
  { value: "week",    label: "This Week" },
  { value: "month",   label: "This Month" },
  { value: "3months", label: "Last 3 Months" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLKR(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("en-LK", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getDateRange(period: string): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let from: Date;
  switch (period) {
    case "today":   from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
    case "week":    from = new Date(to); from.setDate(from.getDate() - 6); from.setHours(0,0,0,0); break;
    case "month":   from = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case "3months": from = new Date(now.getFullYear(), now.getMonth() - 2, 1); break;
    default:        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SalesClient() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");
  const [expandedId, setExpandedId] = useState<string | null | undefined>(undefined);

  // Void / Refund
  const [confirmSale, setConfirmSale] = useState<{ sale: Sale; action: "void" | "refund" } | null>(null);
  const [actioning, setActioning] = useState(false);

  // Exchange
  const [exchangeSale, setExchangeSale] = useState<Sale | null>(null);
  const [exchangeStep, setExchangeStep] = useState<1 | 2>(1);
  const [returnItemIds, setReturnItemIds] = useState<Set<string>>(new Set());
  const [newItems, setNewItems] = useState<NewExchangeItem[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [exchangePayment, setExchangePayment] = useState("CASH");
  const [exchangeTendered, setExchangeTendered] = useState("");
  const [exchanging, setExchanging] = useState(false);

  const limit = 20;

  const fetchSales = useCallback(async (p: number, per: string) => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(per);
      const res = await fetch(`/api/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${p}&limit=${limit}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSales(data.sales.map((s: Sale & { total: string|number; subtotal: string|number; discount: string|number; amountPaid: string|number }) => ({
        ...s,
        total:      Number(s.total),
        subtotal:   Number(s.subtotal),
        discount:   Number(s.discount),
        amountPaid: Number(s.amountPaid),
        items: s.items.map((i: SaleItem & { quantity: string|number; unitPrice: string|number; lineTotal: string|number }) => ({
          ...i,
          quantity:  Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          lineTotal: Number(i.lineTotal),
        })),
      })));
      setTotal(data.total);
    } catch {
      toast.error("Failed to load sales");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSales(page, period); }, [page, period, fetchSales]);

  // Product search for exchange step 2
  useEffect(() => {
    if (!productQuery.trim()) { setProductResults([]); return; }
    setProductSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(productQuery)}&limit=8`);
        const data = await res.json();
        setProductResults(
          (data.products ?? []).map((p: Product & { sellPrice: string|number; stockQty: string|number }) => ({
            ...p, sellPrice: Number(p.sellPrice), stockQty: Number(p.stockQty),
          }))
        );
      } catch { /* silent */ } finally { setProductSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [productQuery]);

  // ── Void / Refund ────────────────────────────────────────────────────────────

  async function handleAction() {
    if (!confirmSale) return;
    setActioning(true);
    try {
      const res = await fetch(`/api/sales/${confirmSale.sale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: confirmSale.action }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Action failed"); return; }
      toast.success(confirmSale.action === "void" ? "Sale voided — stock restored" : "Sale refunded — stock restored");
      setConfirmSale(null);
      fetchSales(page, period);
    } catch {
      toast.error("Failed to update sale");
    } finally {
      setActioning(false);
    }
  }

  // ── Exchange ─────────────────────────────────────────────────────────────────

  function openExchange(sale: Sale) {
    setExchangeSale(sale);
    setExchangeStep(1);
    setReturnItemIds(new Set());
    setNewItems([]);
    setProductQuery("");
    setProductResults([]);
    setExchangePayment("CASH");
    setExchangeTendered("");
  }

  function toggleReturnItem(itemId: string) {
    setReturnItemIds((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  }

  function addNewItem(product: Product) {
    setNewItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        unit: product.unit,
        quantity: 1,
        unitPrice: product.sellPrice,
      }];
    });
    setProductQuery("");
    setProductResults([]);
  }

  function updateNewItemQty(productId: string, delta: number) {
    setNewItems((prev) =>
      prev
        .map((i) => i.productId === productId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)
        .filter((i) => i.quantity > 0)
    );
  }

  function removeNewItem(productId: string) {
    setNewItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  async function handleExchangeConfirm() {
    if (!exchangeSale) return;
    setExchanging(true);
    try {
      const res = await fetch(`/api/sales/${exchangeSale.id}/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnItemIds: Array.from(returnItemIds),
          newItems,
          paymentMethod: exchangePayment,
          amountPaid: netOwed > 0 ? parseFloat(exchangeTendered || "0") : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Exchange failed"); return; }

      const msg = data.cashback > 0
        ? `Exchange complete — return ${formatLKR(data.cashback)} cashback to customer`
        : `Exchange complete${data.fullyExchanged ? " — sale fully exchanged" : ""}`;
      toast.success(msg);
      setExchangeSale(null);
      fetchSales(page, period);
    } catch {
      toast.error("Exchange failed");
    } finally {
      setExchanging(false);
    }
  }

  // Derived exchange values
  const returnedItems = exchangeSale?.items.filter((i) => returnItemIds.has(i.id)) ?? [];
  const returnedValue = returnedItems.reduce((s, i) => s + i.lineTotal, 0);
  const newItemsTotal = newItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const netOwed     = Math.max(0, newItemsTotal - returnedValue);   // customer pays
  const cashback    = Math.max(0, returnedValue - newItemsTotal);   // shop pays out

  const canProceedStep1 = returnItemIds.size > 0 || newItems.length > 0;
  const canConfirm =
    (returnItemIds.size > 0 || newItems.length > 0) &&
    (netOwed === 0 || parseFloat(exchangeTendered || "0") >= netOwed || exchangePayment === "CREDIT");

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales History"
        description="View, search, and manage past transactions"
        action={
          <Select value={period} onValueChange={(v) => { if (v) { setPeriod(v); setPage(1); } }}>
            <SelectTrigger className="w-40">
              <span>{PERIODS.find((p) => p.value === period)?.label}</span>
            </SelectTrigger>
            <SelectContent className="w-max min-w-(--anchor-width)">
              {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {/* Summary strip */}
      {!loading && sales.length > 0 && (
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span>{total} transaction{total !== 1 ? "s" : ""}</span>
          <span>
            {formatLKR(sales.filter((s) => s.status === "COMPLETED").reduce((sum, s) => sum + s.total, 0))} revenue
          </span>
        </div>
      )}

      {/* Sales list */}
      <Card className="shadow-sm overflow-hidden">
        {loading ? (
          <CardContent className="py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        ) : sales.length === 0 ? (
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No sales in this period</p>
          </CardContent>
        ) : (
          <div className="divide-y divide-border">
            {sales.map((sale) => {
              const expanded = expandedId === sale.id;
              const activeItems = sale.items.filter((i) => !i.returned);
              const hasReturnedItems = sale.items.some((i) => i.returned);

              return (
                <div key={sale.id}>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => setExpandedId(expanded ? undefined : sale.id)}
                  >
                    <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{formatDateTime(sale.createdAt)}</p>
                        {sale.customer && (
                          <p className="text-xs text-muted-foreground truncate">{sale.customer.name}</p>
                        )}
                        {sale.originalSaleId && (
                          <p className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-0.5 mt-0.5">
                            <CornerDownRight className="h-3 w-3" /> Exchange
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground hidden sm:block">
                        {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
                        {hasReturnedItems && ` (${sale.items.filter(i=>i.returned).length} returned)`}
                        {" · "}{METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod}
                      </p>
                      <p className="text-sm font-bold font-mono text-right sm:text-left">{formatLKR(sale.total)}</p>
                      <div className="hidden sm:flex justify-end">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[sale.status]}`}>
                          {STATUS_LABELS[sale.status]}
                        </span>
                      </div>
                    </div>
                    {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  </button>

                  {/* Expanded detail */}
                  {expanded && (
                    <div className="px-4 pb-4 bg-muted/20 border-t border-border">
                      <div className="pt-4 space-y-3">
                        <div className="rounded-lg bg-background border border-border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/30">
                                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Product</th>
                                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Qty</th>
                                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Unit Price</th>
                                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sale.items.map((item) => (
                                <tr key={item.id} className={cn("border-b last:border-0", item.returned && "opacity-40")}>
                                  <td className="px-3 py-2 font-medium">
                                    {item.product.name}
                                    {item.returned && (
                                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">Returned</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right text-muted-foreground font-mono">{item.quantity} {item.product.unit}</td>
                                  <td className="px-3 py-2 text-right font-mono">{formatLKR(item.unitPrice)}</td>
                                  <td className={cn("px-3 py-2 text-right font-mono font-semibold", item.returned && "line-through")}>{formatLKR(item.lineTotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex items-start justify-between text-sm gap-4">
                          <div className="space-y-1 text-muted-foreground">
                            {sale.discount > 0 && (
                              <p>
                                {sale.originalSaleId ? "Return Credit" : "Discount"}:{" "}
                                <span className="font-mono text-foreground">- {formatLKR(sale.discount)}</span>
                              </p>
                            )}
                            {sale.paymentMethod === "CREDIT" ? (
                              <div className="space-y-0.5">
                                <p>Payment: <span className="font-medium text-foreground">On Credit</span></p>
                                {sale.status === "PENDING_PAYMENT" ? (
                                  <>
                                    <p className="text-destructive font-medium">Amount Due: {formatLKR(sale.total - sale.amountPaid)}</p>
                                    {sale.amountPaid > 0 && <p className="text-[color:var(--brand-success)]">Paid so far: {formatLKR(sale.amountPaid)}</p>}
                                  </>
                                ) : (
                                  <p className="text-[color:var(--brand-success)] font-medium">Fully settled — {formatLKR(sale.total)}</p>
                                )}
                              </div>
                            ) : (
                              <p>Payment: <span className="font-medium text-foreground">{METHOD_LABELS[sale.paymentMethod]} · {formatLKR(sale.amountPaid)} paid</span></p>
                            )}
                            {sale.paymentMethod === "CASH" && sale.amountPaid > sale.total && (
                              <p>Change: <span className="font-mono text-foreground">{formatLKR(sale.amountPaid - sale.total)}</span></p>
                            )}
                            {sale.originalSaleId && (
                              <p className="text-purple-600 dark:text-purple-400 text-xs">Exchange for sale #{sale.originalSaleId.slice(-6).toUpperCase()}</p>
                            )}
                          </div>

                          {(sale.status === "COMPLETED" || sale.status === "PENDING_PAYMENT") && (
                            <div className="flex gap-2 flex-wrap justify-end">
                              {activeItems.length > 0 && (
                                <Button size="sm" variant="outline"
                                  className="text-xs h-8 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                                  onClick={() => openExchange(sale)}
                                >
                                  <ArrowLeftRight className="h-3 w-3 mr-1" /> Exchange
                                </Button>
                              )}
                              <Button size="sm" variant="outline"
                                className="text-xs h-8 text-amber-700 border-amber-200 hover:bg-amber-50"
                                onClick={() => setConfirmSale({ sale, action: "refund" })}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" /> Refund
                              </Button>
                              <Button size="sm" variant="outline"
                                className="text-xs h-8 text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => setConfirmSale({ sale, action: "void" })}
                              >
                                <XCircle className="h-3 w-3 mr-1" /> Void
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p-1))} disabled={page===1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p+1))} disabled={page===totalPages}>Next</Button>
          </div>
        </div>
      )}

      {/* ── Void / Refund dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!confirmSale} onOpenChange={(o) => !o && setConfirmSale(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmSale?.action === "void" ? "Void this sale?" : "Refund this sale?"}</DialogTitle>
          </DialogHeader>

          {confirmSale && (() => {
            const isCredit = confirmSale.sale.paymentMethod === "CREDIT";
            const debtRemaining = confirmSale.sale.total - confirmSale.sale.amountPaid;
            const partiallyPaid = isCredit && confirmSale.sale.amountPaid > 0;

            return (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {confirmSale.action === "void"
                    ? "This will cancel the sale and restore stock to inventory."
                    : "This will mark the sale as refunded and restore stock to inventory."}
                  {isCredit && debtRemaining > 0 && <> The outstanding credit debt will be cancelled — no cash changes hands.</>}
                </p>

                <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-xs text-muted-foreground">Sale total</span>
                    <span className="font-semibold text-foreground">{formatLKR(confirmSale.sale.total)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {confirmSale.sale.items.length} item{confirmSale.sale.items.length !== 1 ? "s" : ""} ·{" "}
                    {METHOD_LABELS[confirmSale.sale.paymentMethod]} ·{" "}
                    {formatDateTime(confirmSale.sale.createdAt)}
                  </p>
                  {isCredit && (
                    <div className="border-t border-border pt-2 space-y-1">
                      {partiallyPaid && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[color:var(--brand-success)]">Already repaid</span>
                          <span className="font-mono text-[color:var(--brand-success)]">{formatLKR(confirmSale.sale.amountPaid)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-destructive font-medium">Credit debt cancelled</span>
                        <span className="font-mono text-destructive font-bold">{formatLKR(debtRemaining)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {isCredit ? (
                  <div className="space-y-2">
                    <p className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded px-3 py-2">
                      Credit sale — no cash refund applies. Stock will be restored and the remaining debt of{" "}
                      <span className="font-semibold">{formatLKR(debtRemaining)}</span> removed from the customer&apos;s account.
                    </p>
                    {partiallyPaid && (
                      <p className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
                        The {formatLKR(confirmSale.sale.amountPaid)} already repaid is retained by the shop.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800 rounded px-3 py-2">
                    Stock will be restored automatically. This action cannot be undone.
                  </p>
                )}
              </div>
            );
          })()}

          <Separator />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSale(null)} disabled={actioning}>Cancel</Button>
            <Button onClick={handleAction} disabled={actioning}
              className={confirmSale?.action === "void" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-amber-600 hover:bg-amber-700 text-white"}
            >
              {actioning && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {confirmSale?.action === "void" ? "Void Sale" : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Exchange dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!exchangeSale} onOpenChange={(o) => !o && setExchangeSale(null)}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[92vh]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Exchange Items
              <span className="text-xs font-normal text-muted-foreground ml-1">
                Step {exchangeStep} of 2
              </span>
            </DialogTitle>
            {exchangeSale && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Original sale · {formatDateTime(exchangeSale.createdAt)}
                {exchangeSale.customer && ` · ${exchangeSale.customer.name}`}
              </p>
            )}
          </DialogHeader>

          {exchangeSale && (
            <div className="flex flex-col min-h-0 flex-1">
              <div className="flex-1 overflow-y-auto pr-1">

                {/* Step indicators */}
                <div className="flex gap-2 mb-4">
                  {([1, 2] as const).map((s) => (
                    <div key={s} className={cn(
                      "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-colors",
                      exchangeStep === s
                        ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                        : s < exchangeStep
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                    )}>
                      {s}. {s === 1 ? "Select items to return" : "Add replacements & confirm"}
                    </div>
                  ))}
                </div>

                {/* ── STEP 1: Select items to return ── */}
                {exchangeStep === 1 && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Select which items the customer is returning. You can also skip this and add new items only in step 2.
                    </p>
                    <div className="rounded-lg border border-border divide-y divide-border">
                      {exchangeSale.items.filter((i) => !i.returned).map((item) => {
                        const selected = returnItemIds.has(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleReturnItem(item.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                              selected ? "bg-purple-50 dark:bg-purple-950/30" : "hover:bg-muted/40"
                            )}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                              selected ? "bg-purple-600 border-purple-600" : "border-muted-foreground/40"
                            )}>
                              {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{item.product.name}</p>
                              <p className="text-xs text-muted-foreground">{item.quantity} {item.product.unit} · {formatLKR(item.unitPrice)} each</p>
                            </div>
                            <p className="text-sm font-mono font-semibold text-foreground flex-shrink-0">{formatLKR(item.lineTotal)}</p>
                          </button>
                        );
                      })}
                    </div>

                    {returnItemIds.size > 0 && (
                      <div className="flex items-center justify-between text-sm bg-purple-50 dark:bg-purple-950/30 rounded-lg px-4 py-2.5">
                        <span className="text-purple-700 dark:text-purple-300 font-medium">{returnItemIds.size} item{returnItemIds.size !== 1 ? "s" : ""} selected to return</span>
                        <span className="font-mono font-bold text-purple-700 dark:text-purple-300">{formatLKR(returnedValue)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── STEP 2: Replacement items + payment ── */}
                {exchangeStep === 2 && (
                  <div className="space-y-4">
                    {/* Returns summary */}
                    {returnItemIds.size > 0 && (
                      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Returning</p>
                        {returnedItems.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-foreground">{item.product.name} <span className="text-muted-foreground">×{item.quantity}</span></span>
                            <span className="font-mono text-[color:var(--brand-success)]">+{formatLKR(item.lineTotal)}</span>
                          </div>
                        ))}
                        <div className="border-t border-border pt-1 flex justify-between text-sm font-semibold">
                          <span className="text-muted-foreground">Return credit</span>
                          <span className="font-mono text-[color:var(--brand-success)]">{formatLKR(returnedValue)}</span>
                        </div>
                      </div>
                    )}

                    {/* Product search */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add Replacement Items</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search products..."
                          value={productQuery}
                          onChange={(e) => setProductQuery(e.target.value)}
                          className="pl-9"
                        />
                        {productSearching && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {productResults.length > 0 && (
                        <div className="rounded-lg border border-border divide-y divide-border shadow-sm">
                          {productResults.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => addNewItem(p)}
                              disabled={p.stockQty <= 0}
                              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/40 transition-colors disabled:opacity-40"
                            >
                              <div>
                                <p className="text-sm font-medium text-foreground">{p.name}</p>
                                <p className="text-xs text-muted-foreground">Stock: {p.stockQty} {p.unit}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-mono font-semibold">{formatLKR(p.sellPrice)}</p>
                                <p className="text-xs text-primary">+ Add</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* New items list */}
                    {newItems.length > 0 && (
                      <div className="rounded-lg border border-border divide-y divide-border">
                        {newItems.map((item) => (
                          <div key={item.productId} className="flex items-center gap-3 px-3 py-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{item.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{formatLKR(item.unitPrice)} × {item.quantity} = {formatLKR(item.quantity * item.unitPrice)}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateNewItemQty(item.productId, -1)}>
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <span className="text-sm font-mono w-5 text-center">{item.quantity}</span>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateNewItemQty(item.productId, 1)}>
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeNewItem(item.productId)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Net calculation */}
                    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-sm">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Settlement</p>
                      {returnedValue > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Return credit</span>
                          <span className="font-mono text-[color:var(--brand-success)]">−{formatLKR(returnedValue)}</span>
                        </div>
                      )}
                      {newItemsTotal > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">New items</span>
                          <span className="font-mono">{formatLKR(newItemsTotal)}</span>
                        </div>
                      )}
                      <Separator />
                      {netOwed > 0 && (
                        <div className="flex justify-between font-bold text-base">
                          <span className="text-foreground">Customer pays</span>
                          <span className="font-mono text-destructive">{formatLKR(netOwed)}</span>
                        </div>
                      )}
                      {cashback > 0 && (
                        <div className="flex justify-between font-bold text-base">
                          <span className="text-foreground">Return to customer</span>
                          <span className="font-mono text-[color:var(--brand-success)]">{formatLKR(cashback)}</span>
                        </div>
                      )}
                      {netOwed === 0 && cashback === 0 && (returnedValue > 0 || newItemsTotal > 0) && (
                        <p className="text-center text-[color:var(--brand-success)] font-medium text-sm">Even swap — no money changes hands</p>
                      )}
                    </div>

                    {/* Payment method — only if customer owes */}
                    {netOwed > 0 && (
                      <div className="space-y-3">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment Method</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {["CASH","CARD","ONLINE","CREDIT"].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setExchangePayment(m)}
                              className={cn(
                                "py-2 rounded-lg border text-xs font-semibold transition-colors",
                                exchangePayment === m
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background border-border hover:bg-muted"
                              )}
                            >{METHOD_LABELS[m]}</button>
                          ))}
                        </div>
                        {exchangePayment !== "CREDIT" && (
                          <div className="space-y-1.5">
                            <Label htmlFor="extender" className="text-xs">Amount Tendered (LKR)</Label>
                            <Input
                              id="extender"
                              type="number"
                              min={netOwed}
                              step={0.01}
                              value={exchangeTendered}
                              onChange={(e) => setExchangeTendered(e.target.value)}
                              placeholder={netOwed.toFixed(2)}
                              className="font-mono h-11"
                            />
                            {parseFloat(exchangeTendered||"0") > netOwed && (
                              <p className="text-xs text-[color:var(--brand-success)]">
                                Change: {formatLKR(parseFloat(exchangeTendered) - netOwed)}
                              </p>
                            )}
                          </div>
                        )}
                        {exchangePayment === "CREDIT" && (
                          <p className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
                            Balance of {formatLKR(netOwed)} will be added to the customer&apos;s credit account.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Cashback notice */}
                    {cashback > 0 && (
                      <p className="text-sm bg-green-50 dark:bg-green-950/30 text-[color:var(--brand-success)] border border-green-200 dark:border-green-800 rounded-lg px-4 py-2.5 font-medium">
                        Return {formatLKR(cashback)} cash to the customer.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 pt-4 border-t border-border mt-4">
                <div className="flex justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (exchangeStep === 2) setExchangeStep(1);
                      else setExchangeSale(null);
                    }}
                    disabled={exchanging}
                  >
                    {exchangeStep === 2 ? "Back" : "Cancel"}
                  </Button>

                  {exchangeStep === 1 ? (
                    <Button
                      type="button"
                      onClick={() => setExchangeStep(2)}
                      disabled={!canProceedStep1}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Next — Add Replacements
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleExchangeConfirm}
                      disabled={!canConfirm || exchanging}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {exchanging && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Confirm Exchange
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
