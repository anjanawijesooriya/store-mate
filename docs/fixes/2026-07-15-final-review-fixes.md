# Final Pre-Production Review Fixes — 2026-07-15

Two simultaneous reviews (code review + security review) were run against the full branch before production deployment. Ten confirmed issues were identified and fixed across correctness, performance, and security categories.

---

## Code Review — 8 Fixes

### CR1 — LOCKED billing status not enforced at login

**File:** `auth.ts`

**Problem:** `authorize()` fetched `billingStatus` from the shop record but never tested it. A shop whose billing had been set to `LOCKED` by the admin could still receive a valid JWT session and continue operating normally — the billing lock had zero effect at the authentication boundary.

**Fix:** Added a guard immediately after password verification:
```ts
if (user.shop.billingStatus === "LOCKED") return null;
```
LOCKED shops now receive an `null` (rejected login) from `authorize()`, preventing session issuance.

---

### CR2 — Non-atomic payroll deduction replacement

**File:** `app/api/payroll/[id]/route.ts`

**Problem:** When a PATCH request included a new `deductions` array, the handler ran `db.payrollDeduction.deleteMany()` as a standalone write before calling `db.payrollRecord.update()`. These were two separate database operations with no wrapping transaction. If the `update()` failed (e.g. on a constraint violation), the old deductions were permanently deleted with no rollback — leaving the record with zero deductions and a stale `totalDeductions` value.

**Fix:** Moved the delete into a nested relation mutation inside `payrollRecord.update`, making it a single atomic operation:
```ts
deductions: { deleteMany: {}, create: deductionData }
```
If the update fails, neither the delete nor the creates are committed.

---

### CR3 — Password reset revoked all cashier sessions shop-wide

**File:** `app/api/auth/reset-password/route.ts`

**Problem:** The `deviceSession.deleteMany` call in the reset transaction used `where: { shopId: user.shopId }`, which wiped every device session for the entire shop — including all active cashiers. A shop owner resetting their forgotten password would silently log out every cashier mid-shift with no warning.

**Fix:** Scoped the delete to the resetting user only:
```ts
// Before:
db.deviceSession.deleteMany({ where: { shopId: user.shopId } })

// After:
db.deviceSession.deleteMany({ where: { userId: user.id } })
```

---

### CR4 — Exchange completeness check used stale pre-transaction snapshot

**File:** `app/api/sales/[id]/exchange/route.ts`

**Problem:** Inside the transaction, after marking items as returned via `updateMany`, the code computed `nowReturnedCount` by reading `originalSale.items` — the snapshot loaded *before* the transaction opened. Under concurrent exchange requests (two cashiers each returning different subsets of items from the same sale), both requests would see the same snapshot with all `returned=false`, compute separate counts that each fell short of `allItems`, and neither would set the sale to `EXCHANGED`. After both committed, all items would be returned but the sale would be permanently stuck in `COMPLETED`.

**Fix:** Re-queried inside the transaction after the `updateMany`:
```ts
const returnedCount = await tx.saleItem.count({
  where: { saleId: originalSaleId, returned: true },
});
const fullyExchanged = returnedCount >= allItems;
```
Both concurrent requests now see the correct post-write count before deciding the final status.

---

### CR5 — Null dereference on deleted product crashes void/refund

**File:** `app/api/sales/[id]/route.ts`

**Problem:** The void/refund transaction iterated `sale.items` and accessed `item.product.isService` to decide whether to restore stock. Prisma returns `null` for the `product` relation when the referenced product row has been hard-deleted. If any item in the sale pointed to a deleted product, `item.product.isService` threw `TypeError: Cannot read properties of null`, rolling back the entire transaction — stock was never restored and the sale status was never updated.

**Fix:** Changed to optional chaining:
```ts
if (item.product?.isService) { continue; }
```
A null product is treated as a non-service (the safe default), so stock restoration still runs using the stored `item.productId` and `item.variantId`.

---

### CR6 — Stock adjustment had no variant path

**File:** `app/api/products/adjust-stock/route.ts`

**Problem:** The route accepted only `productId` and adjusted `product.stockQty`. For shops using clothing variants (S/M/L), POS reads `productVariant.stockQty` — not the parent product's field. Any manual stock correction would silently update the wrong row, producing a permanent invisible discrepancy that only surfaced on physical counts.

**Fix:** Added `variantId` as an optional request body field. When supplied:
1. Verified the variant belongs to the stated product before any writes.
2. All stock read/write operations (ADJUSTMENT set, re-read inside tx, increment/decrement) now branch on `variantId` to target `productVariant` instead of `product`.

---

### CR7 — Reports used UTC midnight instead of Asia/Colombo midnight

**File:** `app/api/reports/route.ts`, `lib/timezone.ts`

**Problem:** `getDateRange()` constructed all date boundaries with `new Date(year, month, day)`, which produces midnight in the server's local timezone (UTC on Vercel). Sri Lanka is UTC+5:30, so the day boundary was 5 hours 30 minutes late. Sales between 00:00–05:29 local time fell before the UTC midnight cutoff and were attributed to the previous day in every report period. The same bug affected custom date range parsing. `lib/timezone.ts` already exported `localMidnightUTC()` and `localMonthStartUTC()` to solve exactly this problem but they were never imported in the reports route.

**Fix:**
- Added `localDateMidnightUTC(tz, y, mo, d)` export to `lib/timezone.ts` for user-supplied specific dates.
- Rewrote `getDateRange()` to use `localMidnightUTC` and `localMonthStartUTC`:
  ```ts
  case "today":    return { from: localMidnightUTC(SL, 0), to };
  case "week":     return { from: localMidnightUTC(SL, -6), to };
  case "month":    return { from: localMonthStartUTC(SL, 0), to };
  case "last_month": return { from: localMonthStartUTC(SL, -1), to: new Date(localMonthStartUTC(SL, 0).getTime() - 1) };
  case "3months":  return { from: localMonthStartUTC(SL, -2), to };
  ```
- Custom date range now uses `localDateMidnightUTC` for both endpoints instead of `new Date(y, m-1, d)`.

---

### CR8 — Payroll GET had no pagination

**File:** `app/api/payroll/route.ts`

**Problem:** `db.payrollRecord.findMany()` had no `take`/`skip` limit. A shop with 20 employees paid weekly for a year accumulates 1,040+ payroll records, each eager-loading a nested `employee` object and `deductions` array. A single GET request would load all of them into the Vercel serverless function's heap, risking response timeout or OOM crash that would make the Payroll page completely inaccessible.

**Fix:** Added `page` and `limit` query parameters (default limit 50, hard cap 100) matching the pagination pattern already used by `/api/sales` and `/api/products`. The response now includes `total`, `page`, and `limit` fields. A parallel `count()` query avoids a second full table scan.

---

## Security Review — 2 Fixes (Restore Endpoint)

### S1 — Restore endpoint: mass assignment for customers, products, sales, and shopGroups

**File:** `app/api/admin/restore/route.ts`

**Problem:** The `shops` and `users` upserts already had explicit field allowlist pickers (`pickShopFields`, `pickUserFields`). All other entity types passed the raw backup record as `r as any` directly to Prisma with no field filtering. This meant a rogue or compromised admin could upload a crafted backup JSON and:
- Set `creditBalance: 9999999` or `totalSpent: 0` on any customer record
- Set `sellPrice` or `costPrice` to arbitrary values on any product
- Set `status: "COMPLETED"` and `total: 0` on any sale (falsifying transaction records)
- Cross-tenant inject by supplying a foreign `shopId` on any record, reassigning it to a different shop

**Fix:** Added `pickCustomerFields()`, `pickProductFields()`, `pickSaleFields()` allowlist functions mirroring the existing `pickShopFields` pattern. `shopGroups` upsert was also tightened to an explicit field set. All five previously-unguarded entity types now pass through their respective pickers:

```ts
// Customers — prevents creditBalance / totalSpent injection
function pickCustomerFields(r) { return { id, shopId, name, phone, email, address,
  note, totalSpent, creditBalance, createdAt } }

// Products — prevents sellPrice / costPrice injection
function pickProductFields(r) { return { id, shopId, name, itemCode, category,
  unit, sellPrice, costPrice, stockQty, lowStockAt, isActive, isService,
  isWeighted, warrantyPeriod, barcode, createdAt } }

// Sales — prevents status falsification and total manipulation
function pickSaleFields(r) { return { id, shopId, userId, customerId, subtotal,
  discount, total, paymentMethod, amountPaid, cardFee, cardFeeRate,
  status, createdAt } }
```

---

### S2 — Restore endpoint: password hash injection + users restored without passwords failing

**File:** `app/api/admin/restore/route.ts`

**Problem (security):** The `includeHash` flag was `true` whenever `r.passwordHash` was any truthy value — no format validation, no authenticity check. A rogue admin uploading a crafted backup with `{ id: "<victim-uuid>", passwordHash: "$2b$10$<attacker-known-hash>" }` would silently overwrite any user's password, enabling account takeover.

**Problem (correctness):** After Fix S2 in the previous pass removed `passwordHash` from backup exports, new backups no longer carry hashes. When restoring such a backup, the handler fell back to `tx.user.update()` (no upsert) with `.catch(() => null)` to silently skip missing users — meaning users not already in the database were never created, breaking full restores.

**Fix:** Rewrote the users handler with three-way logic:

1. **Hash format validation:** Only trust a backup hash that matches the bcrypt format regex `$2[ab]$NN$<53-char-salt-hash>`. Arbitrary strings are rejected.

2. **Split update/create fields:**
   - `updateFields`: never includes `passwordHash` unless the backup carried a verified bcrypt digest — existing users keep their current password.
   - `createFields`: always includes a hash. If the backup has a verified hash it is used; otherwise a one-time random placeholder is generated via `bcrypt.hash(randomUUID(), 10)`.

3. **Always upsert:** All users now use `tx.user.upsert()` — new users are created with the placeholder hash (they must reset via "forgot password"), existing users are updated without changing their password.

```ts
const placeholderHash = await bcryptHash(randomUUID(), 10);
const BCRYPT_RE = /^\$2[ab]?\$\d{2}\$[./A-Za-z0-9]{53}$/;

// For each user:
const verifiedHash = r.passwordHash && BCRYPT_RE.test(String(r.passwordHash))
  ? r.passwordHash : null;
// update: only sets hash if backup had a verified one
// create: always has a hash (verified or placeholder)
```

---

## Files changed

| Fix | File | Category |
|-----|------|----------|
| CR1 | `auth.ts` | Correctness — billing lock bypass |
| CR2 | `app/api/payroll/[id]/route.ts` | Correctness — non-atomic write |
| CR3 | `app/api/auth/reset-password/route.ts` | Correctness — session scope |
| CR4 | `app/api/sales/[id]/exchange/route.ts` | Correctness — stale read |
| CR5 | `app/api/sales/[id]/route.ts` | Correctness — null dereference |
| CR6 | `app/api/products/adjust-stock/route.ts` | Correctness — missing variant path |
| CR7 | `lib/timezone.ts`, `app/api/reports/route.ts` | Correctness — timezone boundary |
| CR8 | `app/api/payroll/route.ts` | Performance — unbounded query |
| S1  | `app/api/admin/restore/route.ts` | Security — mass assignment |
| S2  | `app/api/admin/restore/route.ts` | Security + Correctness — hash injection / restore failure |
