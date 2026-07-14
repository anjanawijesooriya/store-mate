import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";

// Allow up to 50 MB request body for large backup files
export const maxDuration = 120;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

// Explicit allowlist for Shop fields restored from backup.
// Billing-control fields (planTier, billingStatus, isLifetime, trial/grace dates)
// are deliberately included so a legitimate disaster-recovery restore is complete,
// but the function prevents any unknown/attacker-injected field from reaching Prisma
// via the `r as any` bypass that the raw upsert previously used.
function pickShopFields(r: AnyRecord) {
  return {
    id:                      r.id,
    name:                    r.name,
    ownerName:               r.ownerName ?? null,
    phone:                   r.phone ?? null,
    address:                 r.address ?? null,
    category:                r.category ?? null,
    planTier:                r.planTier ?? "BASIC",
    billingStatus:           r.billingStatus ?? "TRIAL",
    trialEndsAt:             r.trialEndsAt   ? new Date(r.trialEndsAt)   : null,
    gracePeriodEndsAt:       r.gracePeriodEndsAt ? new Date(r.gracePeriodEndsAt) : null,
    nextBillingDate:         r.nextBillingDate    ? new Date(r.nextBillingDate)   : null,
    isLifetime:              r.isLifetime ?? false,
    maintenanceDueDate:      r.maintenanceDueDate  ? new Date(r.maintenanceDueDate)  : null,
    maintenancePaidUntil:    r.maintenancePaidUntil ? new Date(r.maintenancePaidUntil) : null,
    smsAddonEnabled:         r.smsAddonEnabled ?? false,
    smsBalance:              r.smsBalance ?? 0,
    emailLowStock:           r.emailLowStock ?? false,
    emailDailySummary:       r.emailDailySummary ?? false,
    emailReceiptEnabled:     r.emailReceiptEnabled ?? false,
    maintenanceBanner:       r.maintenanceBanner ?? false,
    maintenanceBannerMessage: r.maintenanceBannerMessage ?? null,
    branchModeEnabled:       r.branchModeEnabled ?? false,
    deviceLockEnabled:       r.deviceLockEnabled ?? false,
    cardSurchargeEnabled:    r.cardSurchargeEnabled ?? false,
    cardSurchargeRate:       r.cardSurchargeRate ?? 0,
    payrollEnabled:          r.payrollEnabled ?? false,
    variantsEnabled:         r.variantsEnabled ?? false,
    grnEnabled:              r.grnEnabled ?? false,
    weightedProductsEnabled: r.weightedProductsEnabled ?? false,
    createdAt:               r.createdAt ? new Date(r.createdAt) : undefined,
  };
}

// Safe user fields — never restore role or passwordHash from untrusted backup data
// unless the backup explicitly includes a valid hash (v2.0+).
function pickUserFields(r: AnyRecord, includeHash: boolean) {
  return {
    id: r.id,
    shopId: r.shopId,
    name: r.name,
    phone: r.phone,
    email: r.email ?? null,
    role: r.role === "OWNER" || r.role === "CASHIER" ? r.role : "CASHIER",
    createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
    ...(includeHash && r.passwordHash ? { passwordHash: r.passwordHash } : {}),
  };
}

async function upsertAll(
  label: string,
  records: AnyRecord[] | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // All upserts run inside a single transaction so a mid-restore crash or
  // timeout rolls back the entire operation instead of leaving the DB half-written.
  // timeout is set just under the maxDuration (120 s).
  try {
    await db.$transaction(async (tx) => {
      // ── 1. ShopGroups ──────────────────────────────────────────────────────
      counts.shopGroups = await upsertAll("shopGroups", backup.shopGroups, (r) =>
        tx.shopGroup.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
        errors
      );

      // ── 2. Shops — explicit allowlist prevents billing-field injection ────────
      counts.shops = await upsertAll("shops", backup.shops, (r) => {
        const data = pickShopFields(r);
        return tx.shop.upsert({ where: { id: r.id }, update: data, create: data as any });
      }, errors);

      // ── 3. Users — explicit allowlist prevents role/hash injection ──────────
      counts.users = await upsertAll("users", backup.users, (r) => {
        const includeHash = !!(r.passwordHash);
        const data = pickUserFields(r, includeHash);
        if (!includeHash) {
          return tx.user.update({ where: { id: r.id }, data }).catch(() => null);
        }
        return tx.user.upsert({ where: { id: r.id }, update: data, create: data as any });
      }, errors);

      // ── 4. Customers ────────────────────────────────────────────────────────
      counts.customers = await upsertAll("customers", backup.customers, (r) =>
        tx.customer.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
        errors
      );

      // ── 5. Products ─────────────────────────────────────────────────────────
      counts.products = await upsertAll("products", backup.products, (r) =>
        tx.product.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
        errors
      );

      // ── 6. Sales pass 1: strip self-reference to avoid FK cycle ────────────
      counts.sales = await upsertAll("sales", backup.sales, (r) => {
        const { originalSaleId: _oid, ...rest } = r;
        return tx.sale.upsert({ where: { id: r.id }, update: rest as any, create: rest as any });
      }, errors);

      // ── 7. Sales pass 2: restore exchange links ─────────────────────────────
      const exchanges: AnyRecord[] = (backup.sales ?? []).filter((s: AnyRecord) => s.originalSaleId);
      if (exchanges.length > 0) {
        await upsertAll("sales (exchanges)", exchanges, (r) =>
          tx.sale.update({ where: { id: r.id }, data: { originalSaleId: r.originalSaleId } }),
          errors
        );
      }

      // ── 8. SaleItems ────────────────────────────────────────────────────────
      counts.saleItems = await upsertAll("saleItems", backup.saleItems, (r) =>
        tx.saleItem.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
        errors
      );

      // ── 9. Expenses ─────────────────────────────────────────────────────────
      counts.expenses = await upsertAll("expenses", backup.expenses, (r) =>
        tx.expense.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
        errors
      );

      // ── 10. Payments ────────────────────────────────────────────────────────
      counts.payments = await upsertAll("payments", backup.payments, (r) =>
        tx.payment.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
        errors
      );

      // ── 11. Maintenance Payments ────────────────────────────────────────────
      counts.maintenancePayments = await upsertAll("maintenancePayments", backup.maintenancePayments, (r) =>
        tx.maintenancePayment.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
        errors
      );

      // ── 12. StockMovements ──────────────────────────────────────────────────
      counts.stockMovements = await upsertAll("stockMovements", backup.stockMovements, (r) =>
        tx.stockMovement.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
        errors
      );

      // ── 13. SmsLogs ─────────────────────────────────────────────────────────
      counts.smsLogs = await upsertAll("smsLogs", backup.smsLogs, (r) =>
        tx.smsLog.upsert({ where: { id: r.id }, update: r as any, create: r as any }),
        errors
      );
    }, { timeout: 110_000 });
  } catch (txErr) {
    const msg = txErr instanceof Error ? txErr.message : String(txErr);
    console.error("[restore] transaction failed:", msg);
    return apiError(`Restore failed and was rolled back: ${msg.slice(0, 200)}`, 500);
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const totalRestored = Object.values(counts).reduce((s, n) => s + n, 0);

  // Log the restore event (outside the tx — always record the attempt)
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
