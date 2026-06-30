import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

function getDateRange(period: string): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
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
    const shopId = await getShopId();
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") ?? "week";
    // Browser timezone passed by the client so hour/day extraction is in local time
    const tz = searchParams.get("tz") ?? "UTC";
    const { from, to } = getDateRange(period);

    const [salesRaw, expensesRaw] = await Promise.all([
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
      db.expense.aggregate({
        where: { shopId, expenseDate: { gte: from, lte: to } },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    const sales = salesRaw;
    // Summary
    const totalRevenue = sales.reduce((s: number, sale: typeof sales[0]) => s + Number(sale.total), 0);
    const totalSales = sales.length;
    const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    let totalCOGS = 0;
    const productRevMap = new Map<string, { name: string; qty: number; revenue: number }>();

    for (const sale of sales) {
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

    const totalGrossProfit = totalRevenue - totalCOGS;
    const totalExpenses = Number(expensesRaw._sum.amount ?? 0);
    const totalProfit = totalGrossProfit - totalExpenses;

    // Sales by day — use local timezone so dates match what the user sees
    const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    const dayMap = new Map<string, { date: string; revenue: number; count: number }>();
    for (const sale of salesRaw) {
      const dateStr = dayFmt.format(sale.createdAt); // YYYY-MM-DD in local tz
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

    // Sales by hour — extract local hour from each sale's createdAt using the browser's timezone
    const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false });
    const hourMap = new Map<number, { hour: number; revenue: number; count: number }>();
    for (const sale of salesRaw) {
      const localHour = parseInt(hourFmt.format(sale.createdAt), 10);
      const existing = hourMap.get(localHour);
      if (existing) {
        existing.revenue += Number(sale.total);
        existing.count += 1;
      } else {
        hourMap.set(localHour, { hour: localHour, revenue: Number(sale.total), count: 1 });
      }
    }
    const salesByHour = Array.from(hourMap.values()).sort((a, b) => a.hour - b.hour);

    return Response.json({
      summary: {
        totalRevenue,
        totalSales,
        totalCOGS,
        totalGrossProfit,
        totalExpenses,
        totalProfit,
        avgOrderValue,
      },
      salesByDay,
      salesByPayment,
      salesByHour,
      topProducts,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    console.error(err);
    return apiError("Failed to generate report", 500);
  }
}
