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

    const [salesRaw, hourlyData, payrollAgg, expensesAgg] = await Promise.all([
      db.sale.findMany({
        where: { shopId, createdAt: { gte: from, lte: to }, status: "COMPLETED" },
        include: {
          items: {
            include: {
              product: { select: { name: true, costPrice: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      db.$queryRaw<Array<{ hour: number; revenue: number; count: number }>>`
        SELECT
          EXTRACT(HOUR FROM "createdAt")::int as hour,
          COALESCE(SUM(total), 0)::float as revenue,
          COUNT(id)::int as count
        FROM "Sale"
        WHERE "shopId" = ${shopId}
          AND "createdAt" >= ${from}
          AND "createdAt" <= ${to}
          AND status = 'COMPLETED'
        GROUP BY EXTRACT(HOUR FROM "createdAt")
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

    // Revenue and card fees
    const totalRevenue = salesRaw.reduce((s, sale) => s + Number(sale.total), 0);
    const totalCardFees = salesRaw.reduce((s, sale) => s + Number(sale.cardFee), 0);
    const totalSales = salesRaw.length;
    const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    // COGS and top products
    let totalCOGS = 0;
    const productRevMap = new Map<string, { name: string; qty: number; revenue: number }>();

    for (const sale of salesRaw) {
      for (const item of sale.items) {
        totalCOGS += Number(item.product.costPrice) * Number(item.quantity);
        const existing = productRevMap.get(item.productId);
        if (existing) {
          existing.qty += Number(item.quantity);
          existing.revenue += Number(item.lineTotal);
        } else {
          productRevMap.set(item.productId, {
            name: item.product.name,
            qty: Number(item.quantity),
            revenue: Number(item.lineTotal),
          });
        }
      }
    }

    // Expenses
    const totalExpenses = Number(expensesAgg._sum.amount ?? 0);

    // Payroll
    const totalPayroll = Number(payrollAgg._sum.netAmount ?? 0);

    // P&L
    const totalGrossProfit = totalRevenue - totalCOGS;
    const totalProfit = totalGrossProfit - totalCardFees - totalExpenses - totalPayroll;

    // Sales by day
    const dayMap = new Map<string, { date: string; revenue: number; count: number }>();
    for (const sale of salesRaw) {
      const dateStr = sale.createdAt.toISOString().split("T")[0];
      const existing = dayMap.get(dateStr);
      if (existing) {
        existing.revenue += Number(sale.total);
        existing.count += 1;
      } else {
        dayMap.set(dateStr, { date: dateStr, revenue: Number(sale.total), count: 1 });
      }
    }
    const salesByDay = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Sales by payment method
    const paymentMap = new Map<string, { method: string; total: number; count: number }>();
    for (const sale of salesRaw) {
      const existing = paymentMap.get(sale.paymentMethod);
      if (existing) {
        existing.total += Number(sale.total);
        existing.count += 1;
      } else {
        paymentMap.set(sale.paymentMethod, {
          method: sale.paymentMethod,
          total: Number(sale.total),
          count: 1,
        });
      }
    }
    const salesByPayment = Array.from(paymentMap.values());

    // Top products
    const topProducts = Array.from(productRevMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

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
      salesByHour: (hourlyData as Array<{ hour: number; revenue: number; count: number }>).map((r) => ({
        hour: Number(r.hour),
        revenue: Number(r.revenue),
        count: Number(r.count),
      })),
      topProducts,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    console.error(err);
    return apiError("Failed to generate report", 500);
  }
}
