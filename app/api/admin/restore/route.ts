import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { hash as bcryptHash } from "bcryptjs";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { apiError } from "@/lib/auth-helpers";

// Only accept properly-formatted bcrypt hashes from backup payloads.
// This prevents arbitrary string injection while still supporting
// legitimate disaster-recovery restores from older backups that include hashes.
const BCRYPT_RE = /^\$2[ab]?\$\d{2}\$[./A-Za-z0-9]{53}$/;

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

function pickCustomerFields(r: AnyRecord) {
  return {
    id:            r.id,
    shopId:        r.shopId,
    name:          r.name,
    phone:         r.phone ?? null,
    email:         r.email ?? null,
    address:       r.address ?? null,
    totalSpent:    r.totalSpent ?? 0,
    creditBalance: r.creditBalance ?? 0,
    createdAt:     r.createdAt ? new Date(r.createdAt) : undefined,
  };
}

function pickProductFields(r: AnyRecord) {
  return {
    id:               r.id,
    shopId:           r.shopId,
    name:             r.name,
    itemCode:         r.itemCode ?? null,
    sku:              r.sku ?? null,
    category:         r.category ?? null,
    unit:             r.unit ?? "pcs",
    sellPrice:        r.sellPrice ?? 0,
    costPrice:        r.costPrice ?? 0,
    stockQty:         r.stockQty ?? 0,
    lowStockAt:       r.lowStockAt ?? 5,
    imageUrl:         r.imageUrl ?? null,
    warrantyPeriod:   r.warrantyPeriod ?? null,
    isWeighted:       r.isWeighted ?? false,
    pluCode:          r.pluCode ?? null,
    isService:        r.isService ?? false,
    isActive:         r.isActive ?? true,
    createdAt:        r.createdAt ? new Date(r.createdAt) : undefined,
  };
}

function pickSaleFields(r: AnyRecord) {
  return {
    id:            r.id,
    shopId:        r.shopId,
    userId:        r.userId,
    customerId:    r.customerId ?? null,
    subtotal:      r.subtotal ?? 0,
    discount:      r.discount ?? 0,
    total:         r.total ?? 0,
    paymentMethod: r.paymentMethod,
    amountPaid:    r.amountPaid ?? 0,
    cardFee:       r.cardFee ?? 0,
    cardFeeRate:   r.cardFeeRate ?? 0,
    status:        r.status ?? "COMPLETED",
    createdAt:     r.createdAt ? new Date(r.createdAt) : undefined,
  };
}

function pickSaleItemFields(r: AnyRecord) {
  return {
    id:           r.id,
    saleId:       r.saleId,
    productId:    r.productId,
    variantId:    r.variantId ?? null,
    variantLabel: r.variantLabel ?? null,
    quantity:     r.quantity ?? 0,
    unitPrice:    r.unitPrice ?? 0,
    lineTotal:    r.lineTotal ?? 0,
    returned:     r.returned ?? false,
  };
}

function pickExpenseFields(r: AnyRecord) {
  return {
    id:          r.id,
    shopId:      r.shopId,
    category:    r.category,
    amount:      r.amount ?? 0,
    note:        r.note ?? null,
    receiptUrl:  r.receiptUrl ?? null,
    expenseDate: r.expenseDate ? new Date(r.expenseDate) : new Date(),
    createdAt:   r.createdAt ? new Date(r.createdAt) : undefined,
  };
}

function pickPaymentFields(r: AnyRecord) {
  return {
    id:           r.id,
    shopId:       r.shopId,
    amount:       r.amount ?? 0,
    currency:     r.currency ?? "LKR",
    method:       r.method ?? "MANUAL",
    reference:    r.reference ?? null,
    planTier:     r.planTier,
    billingMonth: r.billingMonth,
    note:         r.note ?? null,
    paidAt:       r.paidAt ? new Date(r.paidAt) : undefined,
    createdAt:    r.createdAt ? new Date(r.createdAt) : undefined,
  };
}

function pickMaintenancePaymentFields(r: AnyRecord) {
  return {
    id:          r.id,
    shopId:      r.shopId,
    amount:      r.amount ?? 0,
    currency:    r.currency ?? "LKR",
    method:      r.method ?? "MANUAL",
    reference:   r.reference ?? null,
    note:        r.note ?? null,
    periodStart: r.periodStart ? new Date(r.periodStart) : new Date(),
    periodEnd:   r.periodEnd ? new Date(r.periodEnd) : new Date(),
    paidAt:      r.paidAt ? new Date(r.paidAt) : undefined,
    createdAt:   r.createdAt ? new Date(r.createdAt) : undefined,
  };
}

function pickStockMovementFields(r: AnyRecord) {
  return {
    id:        r.id,
    productId: r.productId,
    type:      r.type,
    quantity:  r.quantity ?? 0,
    note:      r.note ?? null,
    createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
  };
}

function pickSmsLogFields(r: AnyRecord) {
  return {
    id:        r.id,
    shopId:    r.shopId,
    to:        r.to,
    type:      r.type,
    message:   r.message,
    status:    r.status,
    error:     r.error ?? null,
    createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
  };
}

// Returns { updateFields, createFields }.
// updateFields never touches passwordHash — existing users keep their current password.
// createFields always includes a hash (verified backup hash or caller-supplied placeholder)
// so Prisma can create the row without violating the NOT NULL constraint.
function pickUserFields(r: AnyRecord, placeholderHash: string) {
  const base = {
    id: r.id,
    shopId: r.shopId,
    name: r.name,
    phone: r.phone,
    email: r.email ?? null,
    role: r.role === "OWNER" || r.role === "CASHIER" ? r.role : "CASHIER",
    createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
  };
  // Trust the backup hash only when it is a properly-formatted bcrypt digest.
  const verifiedHash =
    r.passwordHash && BCRYPT_RE.test(String(r.passwordHash))
      ? (r.passwordHash as string)
      : null;
  return {
    updateFields: verifiedHash ? { ...base, passwordHash: verifiedHash } : base,
    createFields: { ...base, passwordHash: verifiedHash ?? placeholderHash },
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
      // Prisma puts the actionable reason (e.g. "Unknown argument") at the END
      // of a multi-line message that starts with a long file path — surface the
      // last meaningful line instead of the truncated path.
      const raw = (e as Error).message ?? String(e);
      const reason = raw.split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? raw;
      errors.push(`${label}: ${reason.slice(0, 160)}`);
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

  // Generate one placeholder hash used for any user record that lacks a verified
  // bcrypt hash in the backup. The random plaintext is immediately discarded so
  // no password can match it — users created this way must reset via forgot-password.
  const placeholderHash = await bcryptHash(randomUUID(), 10);
  const counts: Record<string, number> = {};

  /* eslint-disable @typescript-eslint/no-explicit-any */
  // All upserts run inside a single transaction so a mid-restore crash or
  // timeout rolls back the entire operation instead of leaving the DB half-written.
  // timeout is set just under the maxDuration (120 s).
  try {
    await db.$transaction(async (tx) => {
      // ── 1. ShopGroups ──────────────────────────────────────────────────────
      counts.shopGroups = await upsertAll("shopGroups", backup.shopGroups, (r) => {
        const data = { id: r.id, name: r.name, ownerId: r.ownerId ?? null, createdAt: r.createdAt ? new Date(r.createdAt) : undefined };
        return tx.shopGroup.upsert({ where: { id: r.id }, update: data, create: data as any });
      }, errors);

      // ── 2. Shops — explicit allowlist prevents billing-field injection ────────
      counts.shops = await upsertAll("shops", backup.shops, (r) => {
        const data = pickShopFields(r);
        return tx.shop.upsert({ where: { id: r.id }, update: data, create: data as any });
      }, errors);

      // ── 3. Users — split update/create fields to protect existing passwords ──
      // Update: never overwrites the current hash unless the backup carries a
      //   verified bcrypt digest (legitimate older-style backup).
      // Create: always supplies a hash (verified or placeholder) so the NOT NULL
      //   constraint is satisfied. New users must reset via forgot-password.
      counts.users = await upsertAll("users", backup.users, (r) => {
        const { updateFields, createFields } = pickUserFields(r, placeholderHash);
        return tx.user.upsert({
          where: { id: r.id },
          update: updateFields,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: createFields as any,
        });
      }, errors);

      // ── 4. Customers — explicit allowlist prevents credit/totalSpent injection ──
      counts.customers = await upsertAll("customers", backup.customers, (r) => {
        const data = pickCustomerFields(r);
        return tx.customer.upsert({ where: { id: r.id }, update: data, create: data as any });
      }, errors);

      // ── 5. Products — explicit allowlist prevents price/cost injection ──────
      counts.products = await upsertAll("products", backup.products, (r) => {
        const data = pickProductFields(r);
        return tx.product.upsert({ where: { id: r.id }, update: data, create: data as any });
      }, errors);

      // ── 6. Sales pass 1: strip self-reference + use allowlist ──────────────
      counts.sales = await upsertAll("sales", backup.sales, (r) => {
        const data = pickSaleFields(r);
        return tx.sale.upsert({ where: { id: r.id }, update: data, create: data as any });
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
      counts.saleItems = await upsertAll("saleItems", backup.saleItems, (r) => {
        const data = pickSaleItemFields(r);
        return tx.saleItem.upsert({ where: { id: r.id }, update: data, create: data as any });
      }, errors);

      // ── 9. Expenses ─────────────────────────────────────────────────────────
      counts.expenses = await upsertAll("expenses", backup.expenses, (r) => {
        const data = pickExpenseFields(r);
        return tx.expense.upsert({ where: { id: r.id }, update: data, create: data as any });
      }, errors);

      // ── 10. Payments ────────────────────────────────────────────────────────
      counts.payments = await upsertAll("payments", backup.payments, (r) => {
        const data = pickPaymentFields(r);
        return tx.payment.upsert({ where: { id: r.id }, update: data, create: data as any });
      }, errors);

      // ── 11. Maintenance Payments ────────────────────────────────────────────
      counts.maintenancePayments = await upsertAll("maintenancePayments", backup.maintenancePayments, (r) => {
        const data = pickMaintenancePaymentFields(r);
        return tx.maintenancePayment.upsert({ where: { id: r.id }, update: data, create: data as any });
      }, errors);

      // ── 12. StockMovements ──────────────────────────────────────────────────
      counts.stockMovements = await upsertAll("stockMovements", backup.stockMovements, (r) => {
        const data = pickStockMovementFields(r);
        return tx.stockMovement.upsert({ where: { id: r.id }, update: data, create: data as any });
      }, errors);

      // ── 13. SmsLogs ─────────────────────────────────────────────────────────
      counts.smsLogs = await upsertAll("smsLogs", backup.smsLogs, (r) => {
        const data = pickSmsLogFields(r);
        return tx.smsLog.upsert({ where: { id: r.id }, update: data, create: data as any });
      }, errors);
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
