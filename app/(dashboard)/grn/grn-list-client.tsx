"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ClipboardList,
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type GRNStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

interface GRNSummary {
  id: string;
  supplierName: string | null;
  referenceNo: string | null;
  status: GRNStatus;
  confirmedAt: string | null;
  createdAt: string;
  _count: { items: number };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<GRNStatus, string> = {
  DRAFT:     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CONFIRMED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_ICONS: Record<GRNStatus, React.ReactNode> = {
  DRAFT:     <Clock className="h-3 w-3" />,
  CONFIRMED: <CheckCircle2 className="h-3 w-3" />,
  CANCELLED: <XCircle className="h-3 w-3" />,
};

const STATUS_LABELS: Record<GRNStatus, string> = {
  DRAFT:     "Draft",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

const STATUS_FILTER_OPTIONS = [
  { value: "ALL",       label: "All Statuses" },
  { value: "DRAFT",     label: "Draft" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "CANCELLED", label: "Cancelled" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(d: string) {
  return new Date(d).toLocaleString("en-LK", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GrnListClient() {
  const router = useRouter();
  const [grns, setGrns]           = useState<GRNSummary[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const limit = 20;

  const fetchGrns = useCallback(async (p: number, sf: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (sf !== "ALL") params.set("status", sf);
      const res = await fetch(`/api/grn?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGrns(data.grns);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load GRNs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGrns(page, statusFilter);
  }, [page, statusFilter, fetchGrns]);

  async function handleNewGRN() {
    setCreating(true);
    try {
      const res = await fetch("/api/grn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to create GRN"); return; }
      router.push(`/grn/${data.grn.id}`);
    } catch {
      toast.error("Failed to create GRN");
    } finally {
      setCreating(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goods Received Notes"
        description="Record incoming stock from suppliers"
        action={
          <Button onClick={handleNewGRN} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            New GRN
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => { if (v) { setStatusFilter(v); setPage(1); } }}>
          <SelectTrigger className="w-40 h-9">
            <span>{STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label}</span>
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {statusFilter !== "ALL" && (
          <button className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => { setStatusFilter("ALL"); setPage(1); }}>
            Clear
          </button>
        )}
      </div>

      {/* List */}
      <Card className="shadow-sm overflow-hidden">
        {loading ? (
          <CardContent className="py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        ) : grns.length === 0 ? (
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No GRNs yet — create one to record incoming stock</p>
            <Button variant="outline" size="sm" onClick={handleNewGRN} disabled={creating}>
              {creating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
              New GRN
            </Button>
          </CardContent>
        ) : (
          <div className="divide-y divide-border">
            {grns.map((grn) => (
              <button
                key={grn.id}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted/30 transition-colors text-left"
                onClick={() => router.push(`/grn/${grn.id}`)}
              >
                <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
                  {/* Date + ID */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{formatDateTime(grn.createdAt)}</p>
                    <p className="text-xs text-muted-foreground font-mono">#{grn.id.slice(-8).toUpperCase()}</p>
                  </div>

                  {/* Supplier + ref */}
                  <div className="min-w-0 hidden sm:block">
                    <p className="text-sm text-foreground truncate">{grn.supplierName || <span className="text-muted-foreground italic">No supplier</span>}</p>
                    {grn.referenceNo && (
                      <p className="text-xs text-muted-foreground truncate">Ref: {grn.referenceNo}</p>
                    )}
                  </div>

                  {/* Item count */}
                  <p className="text-sm text-muted-foreground hidden sm:block">
                    {grn._count.items} item{grn._count.items !== 1 ? "s" : ""}
                  </p>

                  {/* Status badge */}
                  <div className="flex justify-end sm:justify-start">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[grn.status]}`}>
                      {STATUS_ICONS[grn.status]}
                      {STATUS_LABELS[grn.status]}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
