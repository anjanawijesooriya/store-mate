import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

const VALID_PAY_TYPES = ["SALARY", "HOURLY", "DAILY"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const shopId = await getShopId();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const existing = await db.employee.findFirst({ where: { id, shopId } });
    if (!existing) return apiError("Employee not found", 404);

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (!body.name?.trim()) return apiError("Name cannot be empty");
      data.name = body.name.trim();
    }
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.email !== undefined) data.email = body.email?.trim() || null;
    if (body.nic !== undefined) data.nic = body.nic?.trim() || null;
    if (body.position !== undefined) data.position = body.position?.trim() || null;
    if (body.payType !== undefined) {
      if (!VALID_PAY_TYPES.includes(body.payType)) return apiError("Invalid pay type");
      data.payType = body.payType;
    }
    if (body.payRate !== undefined) {
      const rate = parseFloat(body.payRate);
      if (isNaN(rate) || rate < 0) return apiError("Pay rate must be a positive number");
      data.payRate = rate;
    }
    if (body.joinDate !== undefined) data.joinDate = body.joinDate ? new Date(body.joinDate) : null;
    if (body.isActive !== undefined) data.isActive = !!body.isActive;

    const employee = await db.employee.update({ where: { id }, data });
    return Response.json({ employee });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to update employee", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const shopId = await getShopId();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    const existing = await db.employee.findFirst({ where: { id, shopId } });
    if (!existing) return apiError("Employee not found", 404);

    const recordCount = await db.payrollRecord.count({ where: { employeeId: id } });
    if (recordCount > 0 && !force) {
      return Response.json(
        { error: "Employee has payroll records", recordCount, requiresForce: true },
        { status: 409 }
      );
    }

    await db.employee.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to delete employee", 500);
  }
}
