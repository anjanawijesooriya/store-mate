import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const category = searchParams.get("category") ?? "";
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "20");

    const where = {
      shopId,
      ...(category && { category }),
      ...(from || to ? {
        expenseDate: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      } : {}),
    };

    const [expenses, total, summary] = await Promise.all([
      db.expense.findMany({
        where,
        orderBy: { expenseDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.expense.count({ where }),
      db.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    return Response.json({
      expenses,
      total,
      totalAmount: Number(summary._sum.amount ?? 0),
      page,
      limit,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to fetch expenses", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const body = await req.json();
    const { category, amount, note, expenseDate, receiptUrl } = body;

    if (!category || amount === undefined || !expenseDate) {
      return apiError("Category, amount and date are required");
    }

    const expense = await db.expense.create({
      data: {
        shopId,
        category: category.trim(),
        amount: parseFloat(amount),
        note: note?.trim() || null,
        expenseDate: new Date(expenseDate),
        receiptUrl: receiptUrl || null,
      },
    });

    return Response.json({ expense }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to create expense", 500);
  }
}
