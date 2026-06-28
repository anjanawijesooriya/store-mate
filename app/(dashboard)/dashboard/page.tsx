import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

async function getDashboardData(shopId: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todaySales, yesterdaySales, weekSales, monthSales, topProducts, weeklySalesChart] =
    await Promise.all([
      db.sale.aggregate({
        where: { shopId, createdAt: { gte: todayStart }, status: "COMPLETED" },
        _sum: { total: true },
        _count: { id: true },
      }),
      db.sale.aggregate({
        where: {
          shopId,
          createdAt: { gte: yesterdayStart, lt: todayStart },
          status: "COMPLETED",
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      db.sale.aggregate({
        where: { shopId, createdAt: { gte: weekStart }, status: "COMPLETED" },
        _sum: { total: true },
      }),
      db.sale.aggregate({
        where: { shopId, createdAt: { gte: monthStart }, status: "COMPLETED" },
        _sum: { total: true },
      }),
      db.saleItem.groupBy({
        by: ["productId"],
        where: {
          sale: { shopId, createdAt: { gte: weekStart }, status: "COMPLETED" },
        },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { lineTotal: "desc" } },
        take: 5,
      }),
      db.$queryRaw<Array<{ date: string; total: number; count: number }>>`
        SELECT
          DATE("createdAt") as date,
          COALESCE(SUM(total), 0)::float as total,
          COUNT(id)::int as count
        FROM "Sale"
        WHERE "shopId" = ${shopId}
          AND "createdAt" >= ${weekStart}
          AND status = 'COMPLETED'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ]);

  const [lowStockCount, productCount, allTimeSalesCount, shop] = await Promise.all([
    db.product.count({
      where: { shopId, isActive: true, stockQty: { lte: 5 } },
    }),
    db.product.count({ where: { shopId, isActive: true } }),
    db.sale.count({ where: { shopId, status: "COMPLETED" } }),
    db.shop.findUnique({
      where: { id: shopId },
      select: { address: true },
    }),
  ]);

  const productIds = topProducts.map((p: typeof topProducts[0]) => p.productId);
  const products =
    productIds.length > 0
      ? await db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, unit: true },
        })
      : [];

  const topProductsWithNames = topProducts.map((p: typeof topProducts[0]) => ({
    productId: p.productId,
    product: products.find((pr: typeof products[0]) => pr.id === p.productId),
    totalQty: Number(p._sum.quantity ?? 0),
    totalRevenue: Number(p._sum.lineTotal ?? 0),
  }));

  const todayTotal = Number(todaySales._sum.total ?? 0);
  const yesterdayTotal = Number(yesterdaySales._sum.total ?? 0);
  const changePct =
    yesterdayTotal > 0
      ? (((todayTotal - yesterdayTotal) / yesterdayTotal) * 100).toFixed(1)
      : null;

  return {
    today: { total: todayTotal, count: todaySales._count.id },
    yesterday: { total: yesterdayTotal, count: yesterdaySales._count.id },
    changePct,
    changePositive: todayTotal >= yesterdayTotal,
    weekTotal: Number(weekSales._sum.total ?? 0),
    monthTotal: Number(monthSales._sum.total ?? 0),
    lowStockCount,
    productCount,
    allTimeSalesCount,
    hasAddress: !!shop?.address,
    topProducts: topProductsWithNames,
    weeklySalesChart: weeklySalesChart.map((r: { date: Date | string; total: number; count: number }) => ({
      date: String(r.date),
      total: Number(r.total),
      count: Number(r.count),
    })),
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.shopId) redirect("/login");

  const data = await getDashboardData(session.user.shopId);

  return <DashboardClient data={data} />;
}
