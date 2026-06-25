"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Receipt, Plus, Loader2, Calendar } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TrendingDown } from "lucide-react";

const EXPENSE_CATEGORIES = [
  "Rent", "Utilities", "Supplies", "Wages", "Transport", "Marketing",
  "Repairs", "Insurance", "Loan Payment", "Purchases / Stock", "Other",
];

interface Expense {
  id: string;
  category: string;
  amount: number;
  note: string | null;
  expenseDate: string;
  createdAt: string;
}

function formatLKR(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" });
}

export function ExpensesClient() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [form, setForm] = useState({
    category: "",
    amount: "",
    note: "",
    expenseDate: new Date().toISOString().split("T")[0],
  });

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set("category", categoryFilter);
      const res = await fetch(`/api/expenses?${params}`);
      const data = await res.json();
      setExpenses(data.expenses ?? []);
      setTotal(data.total ?? 0);
      setTotalAmount(data.totalAmount ?? 0);
    } catch {
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category || !form.amount || !form.expenseDate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          amount: parseFloat(form.amount),
          note: form.note,
          expenseDate: form.expenseDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to add expense"); return; }
      toast.success("Expense recorded");
      setAddOpen(false);
      setForm({ category: "", amount: "", note: "", expenseDate: new Date().toISOString().split("T")[0] });
      fetchExpenses();
    } catch {
      toast.error("Failed to add expense");
    } finally {
      setSaving(false);
    }
  }

  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expenses"
        description={`${total} expense${total !== 1 ? "s" : ""} recorded`}
        action={
          <Button onClick={() => setAddOpen(true)} className="font-semibold">
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Expenses"
          value={formatLKR(totalAmount)}
          icon={TrendingDown}
          iconColor="text-destructive"
        />
        <StatCard
          title="Expense Records"
          value={total.toString()}
          icon={Receipt}
          iconColor="text-primary"
        />
        <StatCard
          title="Categories Used"
          value={Object.keys(categoryTotals).length.toString()}
          icon={Receipt}
          iconColor="text-primary"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={categoryFilter === "" ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter("")}>
          All
        </Button>
        {Object.keys(categoryTotals).map((cat) => (
          <Button
            key={cat}
            variant={categoryFilter === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses recorded"
          description="Track your business expenses to see your true profit and manage your cash flow."
          action={{ label: "Add Expense", onClick: () => setAddOpen(true) }}
        />
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <Card key={expense.id} className="shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{expense.category}</p>
                    <Badge variant="secondary" className="text-xs">{formatDate(expense.expenseDate)}</Badge>
                  </div>
                  {expense.note && (
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{expense.note}</p>
                  )}
                </div>
                <p className="text-lg font-bold font-mono text-destructive flex-shrink-0">
                  {formatLKR(Number(expense.amount))}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={(v) => v && setForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eamount">Amount (LKR) *</Label>
              <Input id="eamount" type="number" min="0" step="0.01" value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                className="font-mono" placeholder="0.00" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edate">Date *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="edate" type="date" value={form.expenseDate}
                  onChange={(e) => setForm((p) => ({ ...p, expenseDate: e.target.value }))}
                  className="pl-9" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enote">Note (optional)</Label>
              <Textarea id="enote" value={form.note} rows={2}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="e.g. Monthly rent payment to landlord" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving} className="font-semibold">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Record Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
