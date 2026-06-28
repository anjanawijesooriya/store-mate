"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Receipt,
  ChevronDown,
  ChevronUp,
  XCircle,
  RotateCcw,
  Search,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

interface SaleItem {
  id: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product: { name: string; unit: string };
}

interface Sale {
  id: string;
  total: number;
  subtotal: number;
  discount: number;
  amountPaid: number;
  paymentMethod: string;
  status: "COMPLETED" | "VOIDED" | "REFUNDED";
  createdAt: string;
  items: SaleItem[];
  customer: { id: string; name: string; phone: string | null } | null;
}

const STATUS_STYLES: Record<Sale["status"], string> = {
  COMPLETED: "bg-green-100 text-green-800",
  VOIDED: "bg-gray-100 text-gray-600",
  REFUNDED: "bg-amber-100 text-amber-800",
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  ONLINE: "Online",
  CREDIT: "Credit",
};

function formatLKR(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("en-LK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "3months", label: "Last 3 Months" },
];

function getDateRange(period: string): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let from: Date;

  switch (period) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      from = new Date(to);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      break;
    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "3months":
      from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  return { from: from.toISOString(), to: to.toISOString() };
}

export function SalesClient() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("week");
  const [expandedId, setExpandedId] = useState<string | null | undefined>(undefined);
  const [confirmSale, setConfirmSale] = useState<{ sale: Sale; action: "void" | "refund" } | null>(null);
  const [actioning, setActioning] = useState(false);

  const limit = 20;

  const fetchSales = useCallback(async (p: number, per: string) => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(per);
      const res = await fetch(
        `/api/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${p}&limit=${limit}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSales(data.sales.map((s: Sale & { total: string | number; subtotal: string | number; discount: string | number; amountPaid: string | number; items: Array<SaleItem & { quantity: string | number; unitPrice: string | number; lineTotal: string | number }> }) => ({
        ...s,
        total: Number(s.total),
        subtotal: Number(s.subtotal),
        discount: Number(s.discount),
        amountPaid: Number(s.amountPaid),
        items: s.items.map((i) => ({
          ...i,
          quantity: Number(i.quantity),
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

  useEffect(() => {
    fetchSales(page, period);
  }, [page, period, fetchSales]);

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
      if (!res.ok) {
        toast.error(data.error || "Action failed");
        return;
      }
      toast.success(
        confirmSale.action === "void" ? "Sale voided — stock restored" : "Sale refunded — stock restored"
      );
      setConfirmSale(null);
      fetchSales(page, period);
    } catch {
      toast.error("Failed to update sale");
    } finally {
      setActioning(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales History"
        description="View, search, and manage past transactions"
        action={
          <Select value={period} onValueChange={(v) => { if (v) { setPeriod(v); setPage(1); } }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* Summary strip */}
      {!loading && sales.length > 0 && (
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span>{total} transaction{total !== 1 ? "s" : ""}</span>
          <span>
            {formatLKR(
              sales
                .filter((s) => s.status === "COMPLETED")
                .reduce((sum, s) => sum + s.total, 0)
            )}{" "}
            revenue
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
              return (
                <div key={sale.id}>
                  {/* Row */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => setExpandedId(expanded ? undefined : sale.id)}
                  >
                    <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {formatDateTime(sale.createdAt)}
                        </p>
                        {sale.customer && (
                          <p className="text-xs text-muted-foreground truncate">
                            {sale.customer.name}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground hidden sm:block">
                        {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
                        {" · "}{METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod}
                      </p>
                      <p className="text-sm font-bold font-mono text-right sm:text-left">
                        {formatLKR(sale.total)}
                      </p>
                      <div className="hidden sm:flex justify-end">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[sale.status]}`}
                        >
                          {sale.status}
                        </span>
                      </div>
                    </div>
                    {expanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
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
                                <tr key={item.id} className="border-b last:border-0">
                                  <td className="px-3 py-2 font-medium">{item.product.name}</td>
                                  <td className="px-3 py-2 text-right text-muted-foreground font-mono">
                                    {item.quantity} {item.product.unit}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono">
                                    {formatLKR(item.unitPrice)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-semibold">
                                    {formatLKR(item.lineTotal)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="space-y-1 text-muted-foreground">
                            {sale.discount > 0 && (
                              <p>Discount: <span className="font-mono text-foreground">- {formatLKR(sale.discount)}</span></p>
                            )}
                            <p>
                              Payment:{" "}
                              <span className="font-medium text-foreground">
                                {METHOD_LABELS[sale.paymentMethod]} · {formatLKR(sale.amountPaid)} paid
                              </span>
                            </p>
                            {sale.paymentMethod === "CASH" && sale.amountPaid > sale.total && (
                              <p>Change: <span className="font-mono text-foreground">{formatLKR(sale.amountPaid - sale.total)}</span></p>
                            )}
                          </div>

                          {sale.status === "COMPLETED" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-8 text-amber-700 border-amber-200 hover:bg-amber-50"
                                onClick={() => setConfirmSale({ sale, action: "refund" })}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Refund
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-8 text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => setConfirmSale({ sale, action: "void" })}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Void
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
          <p className="text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Void/Refund confirmation dialog */}
      <Dialog open={!!confirmSale} onOpenChange={(o) => !o && setConfirmSale(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmSale?.action === "void" ? "Void this sale?" : "Refund this sale?"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              {confirmSale?.action === "void"
                ? "This will cancel the sale and restore stock to inventory. The sale will be marked as VOIDED."
                : "This will mark the sale as refunded and restore stock to inventory."}
            </p>
            {confirmSale && (
              <div className="rounded-lg border bg-muted/40 px-4 py-3 font-mono text-foreground">
                <p className="font-semibold">{formatLKR(confirmSale.sale.total)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {confirmSale.sale.items.length} item{confirmSale.sale.items.length !== 1 ? "s" : ""} ·{" "}
                  {formatDateTime(confirmSale.sale.createdAt)}
                </p>
              </div>
            )}
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
              Stock will be restored automatically. This action cannot be undone.
            </p>
          </div>
          <Separator />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSale(null)} disabled={actioning}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={actioning}
              className={
                confirmSale?.action === "void"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-amber-600 hover:bg-amber-700 text-white"
              }
            >
              {actioning && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {confirmSale?.action === "void" ? "Void Sale" : "Confirm Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
