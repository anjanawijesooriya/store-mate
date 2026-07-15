import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getShopId, apiError, apiUnauthorized, UnauthorizedError } from "@/lib/auth-helpers";

const VALID_PAY_TYPES = ["SALARY", "HOURLY", "DAILY"] as const;

export async function GET(_req: NextRequest) {
  try {
    const shopId = await getShopId();
    const employees = await db.employee.findMany({
      where: { shopId },
      orderBy: { name: "asc" },
    });
    return Response.json({ employees });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to fetch employees", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const shopId = await getShopId();
    const body = await req.json().catch(() => ({}));
    const { name, phone, email, nic, position, payType, payRate, joinDate } = body;

    if (!name?.trim()) return apiError("Name is required");
    if (!VALID_PAY_TYPES.includes(payType)) return apiError("Invalid pay type");
    const rate = parseFloat(payRate);
    if (isNaN(rate) || rate < 0) return apiError("Pay rate must be a positive number");

    const employee = await db.employee.create({
      data: {
        shopId,
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        nic: nic?.trim() || null,
        position: position?.trim() || null,
        payType,
        payRate: rate,
        joinDate: joinDate ? new Date(joinDate) : null,
      },
    });

    return Response.json({ employee }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiUnauthorized();
    return apiError("Failed to create employee", 500);
  }
}
