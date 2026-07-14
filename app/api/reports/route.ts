import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePrimary, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

function getDateRange(period: string): { from: Date; to: Date } {
  const now = new Date();
  let to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
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
    case "last_month":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case "3months":
      from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  return { from, to };
}

export async function GET(req: NextRequest) {
  try {
    const shopId = await requirePrimary();
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") ?? "week";
    const customFrom = searchParams.get("from");
    const customTo = searchParams.get("to");

    let from: Date, to: Date;
    if (period === "custom" && customFrom && customTo) {
      const [fy, fm, fd] = customFrom.split("-").map(Number);
      const [ty, tm, td] = customTo.split("-").map(Number);
      from = new Date(fy, fm - 1, fd, 0, 0, 0);
      to   = new Date(ty, tm - 1, td, 23, 59, 59);
    } else {
      ({ from, to } = getDateRange(period));
    }

    const [summaryAgg, cogsAgg, topProductsRaw, salesByDayRaw, salesByPaymentRaw, hourlyData, payrollAgg, expensesAgg] =
      await Promise.all([
        db.sale.aggregate({
          where: { shopId, createdAt: { gte: from, lte: to }, status: "COMPLETED" },
          _sum: { total: true, cardFee: true },
          _count: { id: true },
        }),
        // Unbounded COGS — sums ALL products sold, not just the top 10
        db.$queryRaw<[{ totalCogs: number }]>`
          SELECT COALESCE(SUM(si.quantity * p."costPrice"), 0)::float AS "totalCogs"
          FROM "SaleItem" si
          JOIN "Sale"    s ON si."saleId"    = s.id
          JOIN "Product" p ON si."productId" = p.id
          WHERE s."shopId"    = ${shopId}
            AND s."createdAt" >= ${from}
            AND s."createdAt" <= ${to}
            AND s.status = 'COMPLETED'
        `,
        // Top 10 by revenue — display only, no cogs column needed here
        db.$queryRaw<Array<{ productId: string; name: string; qty: number; revenue: number }>>`
          SELECT
            si."productId",
            p.name,
            COALESCE(SUM(si.quantity), 0)::float    AS qty,
            COALESCE(SUM(si."lineTotal"), 0)::float AS revenue
          FROM "SaleItem" si
          JOIN "Sale"    s ON si."saleId"    = s.id
          JOIN "Product" p ON si."productId" = p.id
          WHERE s."shopId"    = ${shopId}
            AND s."createdAt" >= ${from}
            AND s."createdAt" <= ${to}
            AND s.status = 'COMPLETED'
          GROUP BY si."productId", p.name
          ORDER BY revenue DESC
          LIMIT 10
        `,
        // salesByDay uses Asia/Colombo local date — matches dashboard bucketing
        db.$queryRaw<Array<{ date: string; revenue: number; count: number }>>`
          SELECT
            DATE(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Colombo')::text AS date,
            COALESCE(SUM(total), 0)::float                                           AS revenue,
            COUNT(id)::int                                                           AS count
          FROM "Sale"
          WHERE "shopId"    = ${shopId}
            AND "createdAt" >= ${from}
            AND "createdAt" <= ${to}
            AND status = 'COMPLETED'
          GROUP BY DATE(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Colombo')
          ORDER BY date ASC
        `,
        db.sale.groupBy({
          by: ["paymentMethod"],
          where: { shopId, createdAt: { gte: from, lte: to }, status: "COMPLETED" },
          _sum: { total: true },
          _count: { id: true },
        }),
        // hourlyData uses Asia/Colombo local hours — avoids 5.5h shift on the chart
        db.$queryRaw<Array<{ hour: number; revenue: number; count: number }>>`
          SELECT
            EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Colombo')::int AS hour,
            COALESCE(SUM(total), 0)::float AS revenue,
            COUNT(id)::int                 AS count
          FROM "Sale"
          WHERE "shopId" = ${shopId}
            AND "createdAt" >= ${from}
            AND "createdAt" <= ${to}
            AND status = 'COMPLETED'
          GROUP BY EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Colombo')
          ORDER BY hour ASC
        `,
        db.payrollRecord.aggregate({
          where: { shopId, periodStart: { gte: from, lte: to } },
          _sum: { netAmount: true },
        }),
        db.expense.aggregate({
          where: { shopId, expenseDate: { gte: from, lte: to } },
          _sum: { amount: true },
        }),
      ]);

    const totalRevenue   = Number(summaryAgg._sum.total   ?? 0);
    const totalCardFees  = Number(summaryAgg._sum.cardFee ?? 0);
    const totalSales     = summaryAgg._count.id;
    const avgOrderValue  = totalSales > 0 ? totalRevenue / totalSales : 0;

    const totalCOGS = Number(cogsAgg[0]?.totalCogs ?? 0);
    const topProducts = topProductsRaw.map((r) => ({
      name:    r.name,
      qty:     Number(r.qty),
      revenue: Number(r.revenue),
    }));

    const totalExpenses = Number(expensesAgg._sum.amount ?? 0);
    const totalPayroll  = Number(payrollAgg._sum.netAmount ?? 0);

    const totalGrossProfit = totalRevenue - totalCOGS;
    const totalProfit      = totalGrossProfit - totalCardFees - totalExpenses - totalPayroll;

    const salesByDay = salesByDayRaw.map((r) => ({
      date:    r.date,
      revenue: Number(r.revenue),
      count:   Number(r.count),
    }));

    const salesByPayment = salesByPaymentRaw.map((r) => ({
      method: r.paymentMethod,
      total:  Number(r._sum.total ?? 0),
      count:  r._count.id,
    }));

    return Response.json({
      summary: {
        totalRevenue,
        totalCOGS,
        totalGrossProfit,
        totalCardFees,
        totalExpenses,
        totalPayroll,
        totalProfit,
        totalSales,
        avgOrderValue,
      },
      salesByDay,
      salesByPayment,
      salesByHour: hourlyData.map((r) => ({
        hour:    Number(r.hour),
        revenue: Number(r.revenue),
        count:   Number(r.count),
      })),
      topProducts,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    console.error(err);
    return apiError("Failed to generate report", 500);
  }
}
