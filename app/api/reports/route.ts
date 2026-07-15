import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePrimary, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";
import { localMidnightUTC, localMonthStartUTC, localDateMidnightUTC } from "@/lib/timezone";

const SL = "Asia/Colombo";

function getDateRange(period: string): { from: Date; to: Date } {
  // Use Asia/Colombo local midnight boundaries — new Date(y, m, d) would use
  // UTC midnight, misattributing sales before 05:30 AM local time to the wrong day.
  const todayStart    = localMidnightUTC(SL, 0);
  const tomorrowStart = localMidnightUTC(SL, 1);
  const to = new Date(tomorrowStart.getTime() - 1); // 23:59:59.999 local today

  switch (period) {
    case "today":
      return { from: todayStart, to };
    case "week":
      return { from: localMidnightUTC(SL, -6), to };
    case "month":
      return { from: localMonthStartUTC(SL, 0), to };
    case "last_month":
      return {
        from: localMonthStartUTC(SL, -1),
        to: new Date(localMonthStartUTC(SL, 0).getTime() - 1),
      };
    case "3months":
      return { from: localMonthStartUTC(SL, -2), to };
    default:
      return { from: todayStart, to };
  }
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
      from = localDateMidnightUTC(SL, fy, fm, fd);
      to   = new Date(localDateMidnightUTC(SL, ty, tm, td + 1).getTime() - 1);
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
            AND si.returned = false
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
            AND si.returned = false
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
