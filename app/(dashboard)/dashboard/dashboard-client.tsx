"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3,
  Package,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Circle,
  X,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardData {
  today: { total: number; count: number };
  yesterday: { total: number; count: number };
  changePct: string | null;
  changePositive: boolean;
  weekTotal: number;
  monthTotal: number;
  lowStockCount: number;
  productCount: number;
  allTimeSalesCount: number;
  hasAddress: boolean;
  topProducts: Array<{
    productId: string;
    product?: { id: string; name: string; unit: string };
    totalQty: number;
    totalRevenue: number;
  }>;
  weeklySalesChart: Array<{ date: string; total: number; count: number }>;
}

function formatLKR(amount: number) {
  return `LKR ${amount.toLocaleString("en-LK", { maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-LK", { weekday: "short", month: "short", day: "numeric" });
}

const ONBOARDING_KEY = "storemate-onboarding-dismissed";

function OnboardingCard({
  hasProduct,
  hasSale,
  hasAddress,
}: {
  hasProduct: boolean;
  hasSale: boolean;
  hasAddress: boolean;
}) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(ONBOARDING_KEY) === "1");
  }, []);

  const allDone = hasProduct && hasSale && hasAddress;

  if (dismissed || allDone) return null;

  const steps = [
    {
      done: hasProduct,
      label: "Add your first product",
      desc: "Go to Inventory → Add Product",
      href: "/inventory",
    },
    {
      done: hasSale,
      label: "Make your first sale",
      desc: "Head to the POS screen",
      href: "/pos",
    },
    {
      done: hasAddress,
      label: "Add your shop address",
      desc: "Update it in Settings",
      href: "/settings",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card className="shadow-sm border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-primary">
            Getting Started — {doneCount}/{steps.length} done
          </CardTitle>
          <button
            onClick={() => {
              localStorage.setItem(ONBOARDING_KEY, "1");
              setDismissed(true);
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-1">
        {steps.map((step) => (
          <Link key={step.href} href={step.done ? "#" : step.href}>
            <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-primary/10 transition-colors">
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${
                    step.done
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }`}
                >
                  {step.label}
                </p>
                {!step.done && (
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export function DashboardClient({ data }: { data: DashboardData }) {
  const chartData = data.weeklySalesChart.map((d) => ({
    ...d,
    label: formatDate(d.date),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your shop performance at a glance"
        action={
          <Link href="/pos">
            <Button className="bg-[color:var(--cta)] hover:bg-[color:var(--cta)]/90 text-[color:var(--cta-foreground)] font-semibold shadow-sm hover:shadow-md transition-all">
              <ShoppingCart className="mr-2 h-4 w-4" />
              New Sale
            </Button>
          </Link>
        }
      />

      {/* Onboarding checklist — only shown to new shops until dismissed */}
      <OnboardingCard
        hasProduct={data.productCount > 0}
        hasSale={data.allTimeSalesCount > 0}
        hasAddress={data.hasAddress}
      />

      {/* Low stock alert banner */}
      {data.lowStockCount > 0 && (
        <Link href="/inventory?filter=low-stock">
          <div className="flex items-center gap-3 rounded-lg border border-[color:var(--brand-warning)]/30 bg-[color:var(--brand-warning)]/10 px-4 py-3 cursor-pointer hover:bg-[color:var(--brand-warning)]/20 transition-colors">
            <AlertTriangle className="h-5 w-5 text-[color:var(--brand-warning)] flex-shrink-0" />
            <p className="text-sm font-medium text-[color:var(--brand-warning)]">
              {data.lowStockCount} product{data.lowStockCount !== 1 ? "s" : ""} running low on stock — tap to restock
            </p>
          </div>
        </Link>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Revenue"
          value={formatLKR(data.today.total)}
          change={data.changePct ? `${data.changePct}%` : undefined}
          changePositive={data.changePositive}
          icon={TrendingUp}
          iconColor="text-primary"
        />
        <StatCard
          title="Today's Sales"
          value={data.today.count.toString()}
          description={`${data.yesterday.count} yesterday`}
          icon={ShoppingCart}
          iconColor="text-primary"
        />
        <StatCard
          title="This Week"
          value={formatLKR(data.weekTotal)}
          icon={BarChart3}
          iconColor="text-primary"
        />
        <StatCard
          title="This Month"
          value={formatLKR(data.monthTotal)}
          icon={Package}
          iconColor="text-primary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales chart */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Sales — Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No sales data yet — make your first sale!
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v) => [formatLKR(Number(v ?? 0)), "Revenue"]}
                    labelStyle={{ fontSize: 12 }}
                    contentStyle={{ fontSize: 12, borderRadius: "8px" }}
                  />
                  <Bar
                    dataKey="total"
                    fill="var(--color-primary)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top products */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top Products This Week</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No sales recorded yet</p>
            ) : (
              <ul className="space-y-3">
                {data.topProducts.map((p, i) => (
                  <li key={p.productId} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5 flex-shrink-0">
                      #{i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {p.product?.name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.totalQty} {p.product?.unit ?? "pcs"} sold
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs font-mono flex-shrink-0">
                      {formatLKR(p.totalRevenue)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/pos", label: "New Sale", icon: ShoppingCart, accent: "bg-primary/10 text-primary hover:bg-primary/15" },
          { href: "/inventory", label: "Add Product", icon: Package, accent: "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15" },
          { href: "/reports", label: "View Reports", icon: BarChart3, accent: "bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/15" },
          { href: "/customers", label: "Customers", icon: TrendingUp, accent: "bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/15" },
        ].map(({ href, label, icon: Icon, accent }) => (
          <Link key={href} href={href}>
            <Card className="shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer h-full group">
              <CardContent className="flex flex-col items-center justify-center py-5 gap-2.5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-foreground text-center">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
