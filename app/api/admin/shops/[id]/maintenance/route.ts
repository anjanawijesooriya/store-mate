import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";

// GET — maintenance payment history for a shop
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return apiError("Unauthorized", 401);
  const { id: shopId } = await params;

  const payments = await db.maintenancePayment.findMany({
    where: { shopId },
    orderBy: { paidAt: "desc" },
  });

  return Response.json({
    payments: payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
    })),
  });
}

// POST — record a maintenance payment
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return apiError("Unauthorized", 401);
  const { id: shopId } = await params;

  const body = await req.json().catch(() => ({}));
  const amount = parseFloat(body.amount);
  if (!amount || amount <= 0) return apiError("Invalid amount", 400);

  const method   = body.method   || "MANUAL";
  const reference = body.reference || null;
  const note     = body.note     || null;

  const now = new Date();
  const shop = await db.shop.findUnique({ where: { id: shopId }, select: { maintenancePaidUntil: true } });
  // Start the new period from where the last one ends (or today if lapsed)
  const periodStart = shop?.maintenancePaidUntil && shop.maintenancePaidUntil > now
    ? shop.maintenancePaidUntil
    : now;
  const periodEnd = new Date(periodStart);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  // Record the payment and update shop maintenance dates in a transaction
  const [payment] = await db.$transaction([
    db.maintenancePayment.create({
      data: {
        shopId,
        amount,
        method,
        reference,
        note,
        periodStart,
        periodEnd,
      },
    }),
    db.shop.update({
      where: { id: shopId },
      data: {
        maintenancePaidUntil: periodEnd,
        maintenanceDueDate:   periodEnd, // next payment due when current period ends
      },
    }),
  ]);

  return Response.json({
    success: true,
    payment: { ...payment, amount: Number(payment.amount) },
    maintenancePaidUntil: periodEnd,
    maintenanceDueDate:   periodEnd,
  });
}
