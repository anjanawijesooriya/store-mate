import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { DeductionType, RecordPeriod } from "@/lib/generated/prisma/client";
import { requirePrimary, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

const VALID_PERIOD_TYPES: RecordPeriod[] = ["DAY", "WEEK", "MONTH"];
const VALID_DEDUCTION_TYPES: DeductionType[] = ["EPF", "ETF", "ADVANCE", "CUSTOM"];

export async function GET(req: NextRequest) {
  try {
    const shopId = await requirePrimary();
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const records = await db.payrollRecord.findMany({
      where: {
        shopId,
        ...(employeeId ? { employeeId } : {}),
        ...(status === "PENDING" || status === "PAID" ? { status } : {}),
        ...(from || to
          ? {
              periodStart: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        employee: { select: { id: true, name: true, position: true, payType: true, payRate: true } },
        deductions: true,
      },
      orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
    });

    return Response.json({
      records: records.map((r) => ({
        ...r,
        hoursWorked: r.hoursWorked !== null ? Number(r.hoursWorked) : null,
        grossAmount: Number(r.grossAmount),
        totalDeductions: Number(r.totalDeductions),
        netAmount: Number(r.netAmount),
        employee: { ...r.employee, payRate: Number(r.employee.payRate) },
        deductions: r.deductions.map((d) => ({ ...d, amount: Number(d.amount) })),
      })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to fetch payroll records", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const shopId = await requirePrimary();
    const body = await req.json().catch(() => ({}));
    const { employeeId, periodType, periodStart, periodEnd, hoursWorked, grossAmount, note, deductions } = body;

    if (!employeeId || !periodType || !periodStart || !periodEnd) {
      return apiError("employeeId, periodType, periodStart, and periodEnd are required");
    }
    if (!VALID_PERIOD_TYPES.includes(periodType as RecordPeriod)) {
      return apiError("Invalid periodType");
    }

    const employee = await db.employee.findFirst({ where: { id: employeeId, shopId, isActive: true } });
    if (!employee) return apiError("Employee not found", 404);

    const payRate = Number(employee.payRate);
    let computedGross: number;

    if (employee.payType === "HOURLY") {
      const hrs = parseFloat(hoursWorked);
      if (isNaN(hrs) || hrs < 0) return apiError("Valid hoursWorked is required for HOURLY employees");
      computedGross = hrs * payRate;
    } else {
      const amt = parseFloat(grossAmount);
      if (isNaN(amt) || amt < 0) return apiError("Valid grossAmount is required");
      computedGross = amt;
    }

    let totalDeductions = 0;
    const deductionData: Array<{ type: DeductionType; label: string; amount: number }> = [];

    if (Array.isArray(deductions)) {
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
    if (netAmount < 0) return apiError("Total deductions exceed gross amount");

    const record = await db.payrollRecord.create({
      data: {
        shopId,
        employeeId,
        periodType: periodType as RecordPeriod,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        hoursWorked: employee.payType === "HOURLY" ? parseFloat(hoursWorked) : null,
        grossAmount: computedGross,
        totalDeductions,
        netAmount,
        note: note?.trim() || null,
        deductions: { create: deductionData },
      },
      include: {
        employee: { select: { id: true, name: true, position: true, payType: true, payRate: true } },
        deductions: true,
      },
    });

    return Response.json({
      record: {
        ...record,
        hoursWorked: record.hoursWorked !== null ? Number(record.hoursWorked) : null,
        grossAmount: Number(record.grossAmount),
        totalDeductions: Number(record.totalDeductions),
        netAmount: Number(record.netAmount),
        employee: { ...record.employee, payRate: Number(record.employee.payRate) },
        deductions: record.deductions.map((d) => ({ ...d, amount: Number(d.amount) })),
      },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to create payroll record", 500);
  }
}
