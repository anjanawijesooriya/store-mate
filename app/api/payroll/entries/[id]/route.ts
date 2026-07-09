import { apiError } from "@/lib/auth-helpers";

export async function PATCH() {
  return apiError("This endpoint has been replaced. Use /api/payroll/[id] instead.", 410);
}
