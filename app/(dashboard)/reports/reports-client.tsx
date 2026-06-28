"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Download, BarChart3, TrendingUp, CreditCard, Clock, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface ReportData {
  summary: {
    totalRevenue: number;
    totalSales: number;
    totalCOGS: number;
    totalGrossProfit: number;
    totalExpenses: number;
    totalProfit: number;
    avgOrderValue: number;
  };
  salesByDay: Array<{ date: string; revenue: number; count: number }>;
  salesByPayment: Array<{ method: string; total: number; count: number }>;
  salesByHour: Array<{ hour: number; revenue: number; count: number }>;
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
}

const PAYMENT_COLORS = {
  CASH: "var(--color-chart-1)",
  CARD: "var(--color-chart-2)",
  ONLINE: "var(--color-chart-3)",
  CREDIT: "var(--color-chart-4)",
};

function formatLKR(n: number) {
  return `LKR ${n.toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;
}

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "3months", label: "Last 3 Months" },
];

export function ReportsClient() {
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?period=${period}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast.error("Failed to load reports"))
      .finally(() => setLoading(false));
  }, [period]);

  function exportCSV() {
    if (!data) return;
    const rows = [
      ["Date", "Revenue (LKR)", "Sales Count"],
      ...data.salesByDay.map((d) => [d.date, d.revenue.toFixed(2), d.count]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const bom = "﻿"; // UTF-8 BOM for Excel Sinhala/Tamil support
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `storemate-sales-${period}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Reports"
        description="Understand your business performance"
        action={
          <div className="flex gap-2">
            <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCSV} disabled={!data}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              title="Net Profit"
              value={formatLKR(data.summary.totalProfit)}
              icon={data.summary.totalProfit >= 0 ? TrendingUp : TrendingDown}
              description="After COGS & expenses"
              iconColor={data.summary.totalProfit >= 0 ? "text-primary" : "text-destructive"}
            />
            <StatCard
              title="Avg Order Value"
              value={formatLKR(data.summary.avgOrderValue)}
              icon={CreditCard}
              iconColor="text-primary"
            />
          </div>

          {/* P&L breakdown */}
          <div className="rounded-xl border bg-card shadow-sm p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Profit & Loss Breakdown</h3>
            <div className="space-y-2 text-sm max-w-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-mono font-semibold">{formatLKR(data.summary.totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Cost of Goods Sold</span>
                <span className="font-mono">- {formatLKR(data.summary.totalCOGS)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">Gross Profit</span>
                <span className="font-mono font-semibold">{formatLKR(data.summary.totalGrossProfit)}</span>
              </div>
              {data.summary.totalExpenses > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Operating Expenses</span>
                  <span className="font-mono">- {formatLKR(data.summary.totalExpenses)}</span>
                </div>
              )}
              <div className={`flex justify-between border-t pt-2 font-bold ${data.summary.totalProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                <span>Net Profit</span>
                <span className="font-mono">{formatLKR(data.summary.totalProfit)}</span>
              </div>
            </div>
          </div>

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
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.salesByPayment}
                        dataKey="total"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
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
        </>
      ) : null}
    </div>
  );
}
