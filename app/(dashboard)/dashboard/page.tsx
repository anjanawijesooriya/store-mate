import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";
import { BranchGuard } from "@/components/dashboard/branch-guard";
import { localMidnightUTC, localMonthStartUTC } from "@/lib/timezone";

// Sri Lanka Standard Time — change here if multi-timezone support is added later
const SHOP_TZ = "Asia/Colombo";

async function getDashboardData(shopId: string) {
  const todayStart     = localMidnightUTC(SHOP_TZ, 0);   // today local midnight
  const yesterdayStart = localMidnightUTC(SHOP_TZ, -1);  // yesterday local midnight
  const weekStart      = localMidnightUTC(SHOP_TZ, -6);  // 6 days ago → 7-day window
  const monthStart     = localMonthStartUTC(SHOP_TZ, 0); // 1st of current local month

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
      // AT TIME ZONE 'UTC' promotes the stored timestamp to timestamptz,
      // then AT TIME ZONE SHOP_TZ converts to local time before DATE() extracts
      // the local calendar date — fixes UTC midnight vs local midnight mismatch.
      // SHOP_TZ is a compile-time constant so it's safe to embed as a SQL
      // literal. Using a bind parameter here causes PostgreSQL to fail to match
      // the GROUP BY expression to the SELECT expression (error 42803).
      db.$queryRaw<Array<{ date: string; total: number; count: number }>>`
        SELECT
          DATE(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Colombo') AS date,
          COALESCE(SUM(total), 0)::float AS total,
          COUNT(id)::int AS count
        FROM "Sale"
        WHERE "shopId" = ${shopId}
          AND "createdAt" >= ${weekStart}
          AND status = 'COMPLETED'
        GROUP BY DATE(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Colombo')
        ORDER BY date ASC
      `,
    ]);

  const [lowStockCount, productCount, allTimeSalesCount, shop] = await Promise.all([
    // Count products where stockQty is between 1 and their own lowStockAt threshold
    // (exclude qty=0 which is already "out of stock", not just "low")
    db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count
      FROM "Product"
      WHERE "shopId" = ${shopId}
        AND "isActive" = true
        AND "stockQty" > 0
        AND "stockQty" <= "lowStockAt"
    `.then((rows) => Number(rows[0].count)),
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

  return <BranchGuard><DashboardClient data={data} /></BranchGuard>;
}
