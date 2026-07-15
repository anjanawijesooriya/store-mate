import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePrimary, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const shopId = await requirePrimary();
    const shop = await db.shop.findUnique({ where: { id: shopId }, select: { planTier: true } });
    if (shop?.planTier === "BASIC") return apiError("Expense tracking requires Standard plan or higher.", 403);
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
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to fetch expenses", 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const shopId = await requirePrimary();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return apiError("Expense id is required");

    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing || existing.shopId !== shopId) return apiError("Expense not found", 404);

    const body = await req.json();
    const { category, amount, note, expenseDate } = body;
    if (!category || amount === undefined || !expenseDate) {
      return apiError("Category, amount and date are required");
    }
    const parsedAmountPatch = parseFloat(amount);
    if (isNaN(parsedAmountPatch) || parsedAmountPatch < 0) return apiError("Amount must be a non-negative number");

    const expense = await db.expense.update({
      where: { id },
      data: {
        category: category.trim(),
        amount: parsedAmountPatch,
        note: note?.trim() || null,
        expenseDate: new Date(expenseDate),
      },
    });
    return Response.json({ expense });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to update expense", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const shopId = await requirePrimary();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return apiError("Expense id is required");

    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing || existing.shopId !== shopId) return apiError("Expense not found", 404);

    await db.expense.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to delete expense", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const shopId = await requirePrimary();
    const shop = await db.shop.findUnique({ where: { id: shopId }, select: { planTier: true } });
    if (shop?.planTier === "BASIC") return apiError("Expense tracking requires Standard plan or higher.", 403);
    const body = await req.json();
    const { category, amount, note, expenseDate, receiptUrl } = body;

    if (!category || amount === undefined || !expenseDate) {
      return apiError("Category, amount and date are required");
    }
    const parsedAmountPost = parseFloat(amount);
    if (isNaN(parsedAmountPost) || parsedAmountPost < 0) return apiError("Amount must be a non-negative number");

    const expense = await db.expense.create({
      data: {
        shopId,
        category: category.trim(),
        amount: parsedAmountPost,
        note: note?.trim() || null,
        expenseDate: new Date(expenseDate),
        receiptUrl: receiptUrl || null,
      },
    });

    return Response.json({ expense }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized(err.reason);
    return apiError("Failed to create expense", 500);
  }
}

