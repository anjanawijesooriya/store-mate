"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Download, BarChart3, TrendingUp, TrendingDown, CreditCard, Clock, Lock } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import * as XLSX from "xlsx";
interface ReportData {
  summary: {
    totalRevenue: number;
    totalCOGS: number;
    totalGrossProfit: number;
    totalCardFees: number;
    totalExpenses: number;
    totalPayroll: number;
    totalProfit: number;
    totalSales: number;
    avgOrderValue: number;
  };
  salesByDay: Array<{ date: string; revenue: number; count: number }>;
  salesByPayment: Array<{ method: string; total: number; count: number }>;
  salesByHour: Array<{ hour: number; revenue: number; count: number }>;
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
}

interface Props {
  planTier: "BASIC" | "STANDARD" | "PREMIUM";
}

const PAYMENT_COLORS = {
  CASH:   "var(--color-chart-1)",
  CARD:   "var(--color-chart-2)",
  ONLINE: "var(--color-chart-3)",
  CREDIT: "var(--color-chart-4)",
};

function formatLKR(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;
}

const PERIODS_BASE = [
  { value: "today",      label: "Today",          pro: false },
  { value: "week",       label: "This Week",       pro: false },
  { value: "month",      label: "This Month",      pro: false },
  { value: "last_month", label: "Last Month",      pro: false },
  { value: "3months",    label: "Last 3 Months",   pro: true  },
  { value: "custom",     label: "Custom Range",    pro: true  },
];

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}


export function ReportsClient({ planTier }: Props) {
  const isPremium = planTier === "PREMIUM";

  const [period, setPeriod] = useState("week");
  const [customFrom, setCustomFrom] = useState(todayStr);
  const [customTo, setCustomTo] = useState(todayStr);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (period === "custom" && (!customFrom || !customTo)) return;
    setLoading(true);
    const url = period === "custom"
      ? `/api/reports?period=custom&from=${customFrom}&to=${customTo}`
      : `/api/reports?period=${period}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast.error("Failed to load reports"))
      .finally(() => setLoading(false));
  }, [period, customFrom, customTo]);

  function exportExcel() {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    const label = PERIODS_BASE.find((p) => p.value === period)?.label ?? period;

    // Sheet 1 — Summary (all plans)
    const summaryRows = [
      ["Report Period", label],
      [],
      ["Metric", "Amount (LKR)"],
      ["Gross Revenue",    +data.summary.totalRevenue.toFixed(2)],
      ["Cost of Goods (COGS)", +data.summary.totalCOGS.toFixed(2)],
      ["Gross Profit",    +data.summary.totalGrossProfit.toFixed(2)],
      ...(data.summary.totalCardFees > 0  ? [["Card Surcharge Fees", +data.summary.totalCardFees.toFixed(2)]]  : []),
      ...(data.summary.totalExpenses > 0  ? [["Operating Expenses",  +data.summary.totalExpenses.toFixed(2)]]  : []),
      ...(data.summary.totalPayroll > 0   ? [["Staff Wages (Payroll)", +data.summary.totalPayroll.toFixed(2)]] : []),
      ["Net Profit",      +data.summary.totalProfit.toFixed(2)],
      [],
      ["Total Sales",     data.summary.totalSales],
      ["Avg Order Value", +data.summary.avgOrderValue.toFixed(2)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

    // Sheet 2 — Sales by Day (all plans)
    const dailyRows = [
      ["Date", "Revenue (LKR)", "Sales Count"],
      ...data.salesByDay.map((d) => [d.date, +d.revenue.toFixed(2), d.count]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dailyRows), "Sales by Day");

    // Sheets 3–5 — Premium only (analytics data exists)
    if (isPremium) {
      const paymentRows = [
        ["Payment Method", "Total Revenue (LKR)", "Sales Count"],
        ...data.salesByPayment.map((r) => [r.method, +r.total.toFixed(2), r.count]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(paymentRows), "Payment Methods");

      const hourRows = [
        ["Hour", "Revenue (LKR)", "Sales Count"],
        ...data.salesByHour.map((r) => [`${r.hour}:00 – ${r.hour + 1}:00`, +r.revenue.toFixed(2), r.count]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hourRows), "Busy Hours");

      const productRows = [
        ["Rank", "Product Name", "Units Sold", "Revenue (LKR)"],
        ...data.topProducts.map((p, i) => [i + 1, p.name, p.qty, +p.revenue.toFixed(2)]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(productRows), "Top Products");
    }

    XLSX.writeFile(wb, `estoremate-report-${period}.xlsx`);
  }

  const periodLabel = PERIODS_BASE.find((p) => p.value === period)?.label ?? "Select";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Reports"
        description="Understand your business performance"
        action={
          <div className="flex flex-wrap gap-2 items-center">
            <Select
              value={period}
              onValueChange={(v) => {
                const opt = PERIODS_BASE.find((p) => p.value === v);
                if (opt?.pro && !isPremium) {
                  toast.info("Upgrade to Premium to use this filter.");
                  return;
                }
                if (v) setPeriod(v);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue>{periodLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PERIODS_BASE.map((p) => (
                  <SelectItem
                    key={p.value}
                    value={p.value}
                    disabled={p.pro && !isPremium}
                    className={p.pro && !isPremium ? "opacity-50" : ""}
                  >
                    <span className="flex items-center gap-2">
                      {p.pro && !isPremium && <Lock className="h-3 w-3 shrink-0" />}
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isPremium && period === "custom" && (
              <>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={todayStr()}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </>
            )}

            <Button variant="outline" onClick={exportExcel} disabled={!data}>
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-44 rounded-xl" />
        </div>
      ) : data ? (
        <>
          {/* Summary stat cards — visible to all plans */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              title="Total Revenue"
              value={formatLKR(data.summary.totalRevenue)}
              icon={TrendingUp}
              iconColor="text-primary"
            />
            <StatCard
              title="Total Sales"
              value={data.summary.totalSales.toString()}
              icon={BarChart3}
              iconColor="text-primary"
            />
            <StatCard
              title="Avg Order Value"
              value={formatLKR(data.summary.avgOrderValue)}
              icon={CreditCard}
              iconColor="text-primary"
            />
            <StatCard
              title="Gross Profit"
              value={formatLKR(data.summary.totalGrossProfit)}
              icon={TrendingUp}
              description="Revenue minus cost of goods"
              iconColor="text-emerald-500"
            />
            <StatCard
              title="Net Profit"
              value={formatLKR(data.summary.totalProfit)}
              icon={data.summary.totalProfit >= 0 ? TrendingUp : TrendingDown}
              description="After all deductions"
              iconColor={data.summary.totalProfit >= 0 ? "text-primary" : "text-destructive"}
            />
          </div>

          {/* P&L Breakdown — visible to all plans */}
          <div className="rounded-xl border bg-card shadow-sm p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Profit &amp; Loss Breakdown</h3>
            <div className="space-y-2 text-sm max-w-md">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross Revenue</span>
                <span className="font-mono font-semibold">{formatLKR(data.summary.totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground pl-4">
                <span>Cost of Goods (COGS)</span>
                <span className="font-mono">− {formatLKR(data.summary.totalCOGS)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-medium">
                <span>Gross Profit</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  {formatLKR(data.summary.totalGrossProfit)}
                </span>
              </div>

              {data.summary.totalCardFees > 0 && (
                <div className="flex justify-between text-muted-foreground pl-4">
                  <span>Card Surcharge Fees</span>
                  <span className="font-mono">− {formatLKR(data.summary.totalCardFees)}</span>
                </div>
              )}
              {data.summary.totalExpenses > 0 && (
                <div className="flex justify-between text-muted-foreground pl-4">
                  <span>Operating Expenses</span>
                  <span className="font-mono">− {formatLKR(data.summary.totalExpenses)}</span>
                </div>
              )}
              {data.summary.totalPayroll > 0 && (
                <div className="flex justify-between text-muted-foreground pl-4">
                  <span>Staff Wages (Payroll)</span>
                  <span className="font-mono">− {formatLKR(data.summary.totalPayroll)}</span>
                </div>
              )}

              <div className={`flex justify-between border-t pt-2 font-bold text-base ${
                data.summary.totalProfit >= 0 ? "text-primary" : "text-destructive"
              }`}>
                <span>Net Profit</span>
                <span className="font-mono">{formatLKR(data.summary.totalProfit)}</span>
              </div>
            </div>

            {(data.summary.totalCardFees > 0 || data.summary.totalExpenses > 0 || data.summary.totalPayroll > 0) && (
              <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Card Fees</p>
                  <p className="font-mono font-semibold text-sm mt-0.5">
                    {formatLKR(data.summary.totalCardFees)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Expenses</p>
                  <p className="font-mono font-semibold text-sm mt-0.5">
                    {formatLKR(data.summary.totalExpenses)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Payroll</p>
                  <p className="font-mono font-semibold text-sm mt-0.5">
                    {formatLKR(data.summary.totalPayroll)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Advanced analytics charts — Premium only */}
          {isPremium ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue over time */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Revenue Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data.salesByDay}>
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(v) => [formatLKR(Number(v ?? 0)), "Revenue"]}
                        contentStyle={{ fontSize: 12, borderRadius: "8px" }}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)"
                        strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Sales by payment method */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Sales by Payment Method</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.salesByPayment.length === 0 ? (
                    <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                      No sales data
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={data.salesByPayment}
                            dataKey="total"
                            nameKey="method"
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            label={false}
                            labelLine={false}
                          >
                            {data.salesByPayment.map((entry, i) => (
                              <Cell
                                key={i}
                                fill={PAYMENT_COLORS[entry.method as keyof typeof PAYMENT_COLORS] ?? `var(--color-chart-${i + 1})`}
                              />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => formatLKR(Number(v ?? 0))} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {data.salesByPayment.map((entry, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full"
                              style={{ background: PAYMENT_COLORS[entry.method as keyof typeof PAYMENT_COLORS] ?? `var(--color-chart-${i + 1})` }}
                            />
                            {entry.method} · {entry.count} sale{entry.count !== 1 ? "s" : ""}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Sales by hour */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Busy Hours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data.salesByHour}>
                      <XAxis
                        dataKey="hour"
                        tickFormatter={(h) => `${h}:00`}
                        tick={{ fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        labelFormatter={(h) => `${h}:00 - ${h + 1}:00`}
                        formatter={(v) => [Number(v ?? 0), "Sales"]}
                        contentStyle={{ fontSize: 11, borderRadius: "8px" }}
                      />
                      <Bar dataKey="count" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Top products */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Top Products</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No sales data</p>
                  ) : (
                    <div className="space-y-3">
                      {data.topProducts.map((p, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.qty} units sold</p>
                          </div>
                          <span className="text-sm font-mono font-semibold text-primary">
                            {formatLKR(p.revenue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="relative rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-10 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <Lock className="h-7 w-7 text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Advanced Analytics — Premium only</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Revenue trends, busy-hour breakdown, payment method breakdown, top products chart, and extended date ranges are available on the Premium plan.
                </p>
              </div>
              <a
                href="/settings"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
              >
                Upgrade to Premium in Settings
              </a>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
