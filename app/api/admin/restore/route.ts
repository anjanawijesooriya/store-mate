import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";

// Allow up to 50 MB request body for large backup files
export const maxDuration = 120;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

async function upsertAll(
  label: string,
  records: AnyRecord[] | undefined,
  fn: (r: AnyRecord) => Promise<unknown>,
  errors: string[]
): Promise<number> {
  if (!records?.length) return 0;
  let ok = 0;
  for (const r of records) {
    try {
      await fn(r);
      ok++;
    } catch (e) {
      errors.push(`${label}: ${(e as Error).message?.slice(0, 120)}`);
    }
  }
  return ok;
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return apiError("Unauthorized", 401);

  // Parse body — sent as application/json from the client
  let backup: AnyRecord;
  try {
    backup = await req.json();
  } catch {
    return apiError("Invalid JSON", 400);
  }

  if (!backup._meta) {
    return apiError("Invalid backup file — missing _meta header", 400);
  }

  const errors: string[] = [];
  const counts: Record<string, number> = {};

  /* eslint-disable @typescript-eslint/no-explicit-any */
  // ── 1. ShopGroups (no FK deps) ───────────────────────────────────────────
  counts.shopGroups = await upsertAll("shopGroups", backup.shopGroups, (r) =>
    db.shopGroup.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
    errors
  );

  // ── 2. Shops ─────────────────────────────────────────────────────────────
  counts.shops = await upsertAll("shops", backup.shops, (r) =>
    db.shop.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
    errors
  );

  // ── 3. Users ─────────────────────────────────────────────────────────────
  // passwordHash was excluded in v1.0 backups — skip create if missing, still update existing
  counts.users = await upsertAll("users", backup.users, (r) => {
    if (!r.passwordHash) {
      return db.user.update({ where: { id: r.id }, data: r as any }).catch(() => null);
    }
    return db.user.upsert({ where: { id: r.id }, update: r as any, create: r as any });
  }, errors);

  // ── 4. Customers ─────────────────────────────────────────────────────────
  counts.customers = await upsertAll("customers", backup.customers, (r) =>
    db.customer.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
    errors
  );

  // ── 5. Products ──────────────────────────────────────────────────────────
  counts.products = await upsertAll("products", backup.products, (r) =>
    db.product.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
    errors
  );

  // ── 6. Sales — pass 1: strip self-reference to avoid FK cycle ────────────
  counts.sales = await upsertAll("sales", backup.sales, (r) => {
    const { originalSaleId: _oid, ...rest } = r;
    return db.sale.upsert({ where: { id: r.id }, update: rest as any, create: rest as any });
  }, errors);

  // ── 7. Sales — pass 2: restore exchange links ────────────────────────────
  const exchanges: AnyRecord[] = (backup.sales ?? []).filter((s: AnyRecord) => s.originalSaleId);
  if (exchanges.length > 0) {
    await upsertAll("sales (exchanges)", exchanges, (r) =>
      db.sale.update({ where: { id: r.id }, data: { originalSaleId: r.originalSaleId } }),
      errors
    );
  }

  // ── 8. SaleItems ─────────────────────────────────────────────────────────
  counts.saleItems = await upsertAll("saleItems", backup.saleItems, (r) =>
    db.saleItem.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
    errors
  );

  // ── 9. Expenses ──────────────────────────────────────────────────────────
  counts.expenses = await upsertAll("expenses", backup.expenses, (r) =>
    db.expense.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
    errors
  );

  // ── 10. Payments (monthly billing) ───────────────────────────────────────
  counts.payments = await upsertAll("payments", backup.payments, (r) =>
    db.payment.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
    errors
  );

  // ── 11. Maintenance Payments ──────────────────────────────────────────────
  counts.maintenancePayments = await upsertAll("maintenancePayments", backup.maintenancePayments, (r) =>
    db.maintenancePayment.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
    errors
  );

  // ── 12. StockMovements ────────────────────────────────────────────────────
  counts.stockMovements = await upsertAll("stockMovements", backup.stockMovements, (r) =>
    db.stockMovement.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
    errors
  );

  // ── 13. SmsLogs ───────────────────────────────────────────────────────────
  counts.smsLogs = await upsertAll("smsLogs", backup.smsLogs, (r) =>
    db.smsLog.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
    errors
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const totalRestored = Object.values(counts).reduce((s, n) => s + n, 0);

  // Log the restore event
  await db.backupLog.create({
    data: {
      type: "restore",
      status: errors.length === 0 ? "success" : "partial",
      fileName: `restore-${backup._meta.exportedAt}`,
      error: errors.length > 0 ? errors.slice(0, 5).join(" | ") : null,
    },
  });

  return Response.json({
    success: true,
    meta: backup._meta,
    counts,
    totalRestored,
    errors: errors.slice(0, 20),
  });
}
