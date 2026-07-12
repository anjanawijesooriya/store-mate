import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return apiError("Unauthorized", 401);

  const { id: shopId } = await params;
  if (!shopId) return apiError("Shop ID required");

  const shop = await db.shop.findUnique({ where: { id: shopId }, select: { id: true } });
  if (!shop) return apiError("Shop not found", 404);

  // Delete in dependency order — children before parents
  await db.$transaction([
    db.saleItem.deleteMany({ where: { sale: { shopId } } }),
    db.stockMovement.deleteMany({ where: { product: { shopId } } }),
    db.smsLog.deleteMany({ where: { shopId } }),
    db.deviceSession.deleteMany({ where: { shopId } }),
    // PasswordResetToken has no cascade from User
    db.passwordResetToken.deleteMany({ where: { user: { shopId } } }),
    // PayrollDeduction cascades from PayrollRecord, but PayrollRecord has no cascade from Shop
    db.payrollDeduction.deleteMany({ where: { record: { shopId } } }),
    db.payrollRecord.deleteMany({ where: { shopId } }),
    db.employee.deleteMany({ where: { shopId } }),
    db.maintenancePayment.deleteMany({ where: { shopId } }),
    db.sale.deleteMany({ where: { shopId } }),
    db.product.deleteMany({ where: { shopId } }),
    db.customer.deleteMany({ where: { shopId } }),
    db.expense.deleteMany({ where: { shopId } }),
    db.payment.deleteMany({ where: { shopId } }),
    db.user.deleteMany({ where: { shopId } }),
    db.shop.delete({ where: { id: shopId } }),
  ]);

  return Response.json({ success: true });
}
