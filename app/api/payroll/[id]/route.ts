import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { DeductionType } from "@/lib/generated/prisma/client";
import { requirePrimary, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

const VALID_DEDUCTION_TYPES: DeductionType[] = ["EPF", "ETF", "ADVANCE", "CUSTOM"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const shopId = await requirePrimary();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const existing = await db.payrollRecord.findFirst({ where: { id, shopId } });
    if (!existing) return apiError("Payroll record not found", 404);

    if (existing.status === "PAID" && body.status !== "PENDING") {
      return apiError("Paid records cannot be edited. Delete and re-create to correct.");
    }

    const { status, hoursWorked, grossAmount, note, deductions, periodType, periodStart, periodEnd } = body;

    // Determine gross amount
    let computedGross = Number(existing.grossAmount);
    const employee = await db.employee.findFirst({ where: { id: existing.employeeId, shopId } });

    if (employee?.payType === "HOURLY" && hoursWorked !== undefined) {
      const hrs = parseFloat(hoursWorked);
      if (!isNaN(hrs) && hrs >= 0) {
        computedGross = hrs * Number(employee.payRate);
      }
    } else if (grossAmount !== undefined) {
      const amt = parseFloat(grossAmount);
      if (!isNaN(amt) && amt >= 0) computedGross = amt;
    }

    // Process deductions
    let totalDeductions = Number(existing.totalDeductions);
    let deductionData: Array<{ type: DeductionType; label: string; amount: number }> | null = null;

    if (Array.isArray(deductions)) {
      totalDeductions = 0;
      deductionData = [];
      for (const d of deductions) {
        if (!VALID_DEDUCTION_TYPES.includes(d.type as DeductionType)) {
          return apiError(`Invalid deduction type: ${d.type}`);
        }
        if (!d.label?.trim()) return apiError("Deduction label is required");
        const amount = parseFloat(d.amount);
        if (isNaN(amount) || amount < 0) return apiError("Deduction amount must be a positive number");
        totalDeductions += amount;
        deductionData.push({ type: d.type as DeductionType, label: d.label.trim(), amount });
      }
    }

    const netAmount = computedGross - totalDeductions;
    const markingPaid = status === "PAID" && existing.status === "PENDING";
    const markingPending = status === "PENDING" && existing.status === "PAID";

    // Replace deductions if new set provided
    if (deductionData !== null) {
      await db.payrollDeduction.deleteMany({ where: { payrollRecordId: id } });
    }

    const updated = await db.payrollRecord.update({
      where: { id },
      data: {
        hoursWorked: employee?.payType === "HOURLY" && hoursWorked !== undefined
          ? parseFloat(hoursWorked)
          : undefined,
        grossAmount: computedGross,
        totalDeductions,
        netAmount,
        note: note !== undefined ? (note?.trim() || null) : undefined,
        periodType: periodType ?? undefined,
        periodStart: periodStart ? new Date(periodStart) : undefined,
        periodEnd: periodEnd ? new Date(periodEnd) : undefined,
        status: markingPaid ? "PAID" : markingPending ? "PENDING" : undefined,
        paidAt: markingPaid ? new Date() : markingPending ? null : undefined,
        ...(deductionData !== null
          ? { deductions: { create: deductionData } }
          : {}),
      },
      include: {
        employee: { select: { id: true, name: true, position: true, payType: true, payRate: true } },
        deductions: true,
      },
    });

    return Response.json({
      record: {
        ...updated,
        hoursWorked: updated.hoursWorked !== null ? Number(updated.hoursWorked) : null,
        grossAmount: Number(updated.grossAmount),
        totalDeductions: Number(updated.totalDeductions),
        netAmount: Number(updated.netAmount),
        employee: { ...updated.employee, payRate: Number(updated.employee.payRate) },
        deductions: updated.deductions.map((d) => ({ ...d, amount: Number(d.amount) })),
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to update payroll record", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const shopId = await requirePrimary();
    const { id } = await params;

    const existing = await db.payrollRecord.findFirst({ where: { id, shopId } });
    if (!existing) return apiError("Payroll record not found", 404);
    if (existing.status === "PAID") return apiError("Cannot delete a paid record");

    await db.payrollRecord.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to delete payroll record", 500);
  }
}
