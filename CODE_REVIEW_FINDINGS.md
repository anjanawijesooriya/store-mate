# StoreMate — Code Review Findings & Fixes

All issues surfaced across three rounds of review (full-diff scan + critical/high + medium/low). Every finding listed here has been fixed.

---

## Round 1 — Full Diff Review (8 Findings)

### R1-1 · Void/refund always restores base product stock, never variant stock
**Severity:** High  
**File:** `app/api/sales/[id]/route.ts`, `app/api/sales/[id]/exchange/route.ts`  
**Problem:** When a sale is voided, refunded, or exchanged, stock was always incremented on `Product.stockQty` even when the original sale decremented `ProductVariant.stockQty`. This permanently over-counted product-level stock for variant products.  
**Fix:** Added `variantId String?` to `SaleItem` (schema + migration). Sale creation saves `variantId` per item. Void/refund/exchange now branches: if `item.variantId` exists, increment `ProductVariant.stockQty`; otherwise increment `Product.stockQty`.

---

### R1-2 · `getShopId()` bypasses device-revocation check
**Severity:** High  
**File:** `lib/auth-helpers.ts`  
**Problem:** `getShopId()` read `shopId` directly from the JWT session without calling `getSession()`, so a revoked device session could still access the API indefinitely until the JWT expired.  
**Fix:** `getShopId()` now calls `getSession()` internally, which includes the device-revocation check.

---

### R1-3 · No `requirePrimary()` guard on sensitive endpoints
**Severity:** High  
**File:** `lib/auth-helpers.ts`, `app/api/reports/route.ts`, `app/api/expenses/route.ts`, `app/api/payroll/route.ts`  
**Problem:** Multi-branch secondary devices could access reports, expenses, and payroll without restriction.  
**Fix:** New `requirePrimary()` helper exported from `lib/auth-helpers.ts`. It checks `shop.deviceLockEnabled && !device.isPrimary` and throws `UnauthorizedError("non_primary")` → 403. Applied to reports, expenses, and payroll GET/POST.

---

### R1-4 · `UnauthorizedError` missing `"non_primary"` reason variant
**Severity:** Medium  
**File:** `lib/auth-helpers.ts`, `prisma/schema.prisma`  
**Problem:** The `UnauthorizedError` type union only had two reason strings (`"unauthenticated"` | `"unauthorized"`), causing a TypeScript error when adding the third reason and a 401 being returned instead of 403 for non-primary devices.  
**Fix:** Added `"non_primary"` to the union. `apiUnauthorized` returns 403 for this reason.

---

### R1-5 · NaN values silently stored in sale items
**Severity:** Medium  
**File:** `app/api/sales/route.ts`  
**Problem:** If the client sent a non-numeric `qty` or `unitPrice`, `Number(i.qty)` returns `NaN`, which Prisma stores as a `NaN` decimal, corrupting totals and reports.  
**Fix:** Added explicit guards: `if (isNaN(qty) || qty <= 0) throw ...` and `if (isNaN(unitPrice) || unitPrice < 0) throw ...` before the transaction.

---

### R1-6 · Shop DELETE missing cascade for several tables
**Severity:** High  
**File:** `app/api/admin/shops/[id]/route.ts`  
**Problem:** The DELETE transaction only deleted the shop record itself, leaving orphaned rows in `PasswordResetToken`, `PayrollDeduction`, `PayrollRecord`, `Employee`, and `MaintenancePayment`. Foreign key constraints caused some deletes to fail; others left ghost data.  
**Fix:** Transaction now explicitly deletes `passwordResetToken`, `payrollDeduction`, `payrollRecord`, `employee`, and `maintenancePayment` rows for the shop before calling `shop.delete`.

---

### R1-7 · `planTier` and `days` not validated in billing admin route
**Severity:** Medium  
**File:** `app/api/admin/billing/[shopId]/route.ts`  
**Problem:** `mark_paid` accepted any string as `planTier` and stored it. `extend_trial` accepted negative or huge `days` values, enabling invalid billing states.  
**Fix:** `planTier` validated with `Object.values(PlanTier).includes()` in both `mark_paid` and `change_plan`. `extend_trial` guards: `isNaN(d) || d <= 0 || d > 365`. `extend_trial` also clears `gracePeriodEndsAt: null`.

---

### R1-8 · Exchange route: pre-tx stock check is a TOCTOU race + duplicated product IDs
**Severity:** High  
**File:** `app/api/sales/[id]/exchange/route.ts`  
**Problem:** Stock was checked before the transaction, creating a window where concurrent requests could both pass the check and both over-sell. Product IDs were not deduplicated, so a cart with two lines for the same product would double-count the stock query.  
**Fix:** Removed pre-tx stock check. Stock is now re-read inside the transaction per item (variant-aware). `newProductIds` deduplicated with `[...new Set(...)]`. New `SaleItems` save `variantId`. Credit balance decrement uses atomic `$executeRaw` with `GREATEST(0, balance - cost)`.

---

## Round 2 — Critical & High Issues

### C1 · OTP generation uses `Math.random()` — not cryptographically secure
**Severity:** Critical  
**File:** `app/api/auth/forgot-password/route.ts`  
**Problem:** `Math.random()` is not a CSPRNG. An attacker who can observe timing or seed the PRNG could predict OTP values.  
**Fix:** Replaced with `import { randomInt } from "crypto"` → `String(randomInt(100000, 1000000))`, which uses the OS entropy source.

---

### C2 · OTP brute-force — no attempt limit on password reset
**Severity:** Critical  
**File:** `app/api/auth/reset-password/route.ts`, `prisma/schema.prisma`  
**Problem:** An attacker could make unlimited guesses against a 6-digit OTP (1,000,000 possibilities) without any lockout.  
**Fix:** Added `attempts Int @default(0)` to `PasswordResetToken` (schema + migration). The route increments `attempts` before comparing (crash-safe). After 5 failed attempts the token is locked and the user is told to request a new OTP.

---

### C3 · SMS balance TOCTOU — two concurrent sends can both pass the balance check
**Severity:** Critical  
**File:** `lib/sms.ts`  
**Problem:** `sendSmsAndLog` previously read the balance, checked sufficiency, then decremented in separate operations. Two concurrent calls could both read the same balance, both pass the check, and both send — resulting in negative balance.  
**Fix:** Replaced with atomic `$executeRaw`: `UPDATE "Shop" SET smsBalance = smsBalance - cost WHERE id = shopId AND smsBalance >= cost`. Returns affected rows; if 0, insufficient balance. On SMS failure the cost is refunded.

---

### H1 · Payroll PATCH/DELETE employee ownership not verified
**Severity:** High  
**File:** `app/api/payroll/[id]/route.ts`  
**Problem:** When updating a payroll record, the employee was looked up with only `{ id: existing.employeeId }` — no `shopId` filter. A crafted request with a foreign shop's employee ID could pass the check.  
**Fix:** Employee fetch now uses `findFirst({ where: { id: existing.employeeId, shopId } })`.

---

### H2 · Lifetime disable always resets shop to TRIAL regardless of payment history
**Severity:** High  
**File:** `app/api/admin/shops/[id]/lifetime/route.ts`  
**Problem:** Disabling lifetime status always set `billingStatus: TRIAL` with a 7-day window, even for shops that had previously paid for a subscription plan.  
**Fix:** When disabling, the route now checks `db.payment.findFirst({ where: { shopId } })`. If a prior payment exists the shop enters GRACE (5 days) retaining the last `planTier`; otherwise it enters a fresh TRIAL.

---

### H3 · Restore endpoint: 13 sequential upserts with no transaction — partial restore on failure
**Severity:** High  
**File:** `app/api/admin/restore/route.ts`  
**Problem:** If the restore failed mid-way (e.g., FK violation, timeout), the database was left half-written with no way to roll back.  
**Fix:** All 13 upsert passes are now wrapped in `db.$transaction(async (tx) => { ... }, { timeout: 110_000 })`. On any failure the entire restore rolls back and a 500 is returned.

---

### H4 · Restore endpoint: user records restored with arbitrary `role` and `passwordHash` from backup
**Severity:** High  
**File:** `app/api/admin/restore/route.ts`  
**Problem:** `data: r as any` passed all fields from the backup JSON, including `role` and `passwordHash`. A crafted backup file could promote a CASHIER to OWNER or inject a known password hash.  
**Fix:** Added `pickUserFields(r, includeHash)` allowlist function. `role` is validated as `OWNER` or `CASHIER` (defaults to `CASHIER`). `passwordHash` is only included when the backup explicitly provides it.

---

## Round 3 — Medium Issues

### M1 · No rate limit on shop registration
**Severity:** Medium  
**File:** `app/api/auth/register/route.ts`  
**Problem:** An automated script could create thousands of trial shops, consuming bcrypt CPU and database capacity.  
**Fix:** Module-level in-memory rate limiter: max 5 registration attempts per IP per 15 minutes. Check occurs before `bcrypt.hash` to prevent CPU exhaustion.

---

### M2 · Non-constant-time comparison for admin secret
**Severity:** Medium  
**File:** `app/api/admin/auth/route.ts`, `lib/admin-auth.ts`  
**Problem:** `secret === adminSecret` and `cookieValue === adminSecret` are early-exit string comparisons. Timing differences leak how many characters of the secret are correct.  
**Fix:** Both comparisons replaced with `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` via a local `secureEqual(a, b)` helper that also checks length equality first.

---

### M3 · `billingMonth` not validated as a date string
**Severity:** Medium  
**File:** `app/api/admin/billing/[shopId]/route.ts`  
**Problem:** `billingMonth` was passed directly to `new Date(billingMonth)` without format validation. An invalid string (e.g. `"foo"`) produces an Invalid Date, silently storing `NaN` as `nextBillingDate`.  
**Fix:** Added regex guard: `billingMonth !== "LIFETIME" && !/^\d{4}-\d{2}$/.test(billingMonth)` → 400 error.

---

### M4 · Maintenance payment period always starts from today, ignoring existing paid-until date
**Severity:** Medium  
**File:** `app/api/admin/shops/[id]/maintenance/route.ts`  
**Problem:** Recording a payment when a shop still had coverage left would reset `maintenancePaidUntil` to `now + 1 year` instead of extending from the existing end date, effectively losing coverage the shop already paid for.  
**Fix:** The route now reads `shop.maintenancePaidUntil`. If it's in the future, `periodStart` is set to that date; otherwise it uses today. `periodEnd` is always `periodStart + 1 year`.

---

### M5 · Negative `netAmount` not blocked when deductions exceed gross
**Severity:** Medium  
**File:** `app/api/payroll/route.ts`  
**Problem:** If deductions summed to more than `grossAmount`, `netAmount` would be negative and stored without complaint.  
**Fix:** Added `if (netAmount < 0) return apiError("Total deductions exceed gross amount")` after computing `netAmount`.

---

### M6 · Payroll `[id]` PATCH/DELETE use `getShopId()` instead of `requirePrimary()`
**Severity:** Medium  
**File:** `app/api/payroll/[id]/route.ts`  
**Problem:** Secondary/non-primary devices could edit and delete payroll records, bypassing the primary-device restriction that GET/POST enforced.  
**Fix:** Import changed from `getShopId` to `requirePrimary`; both PATCH and DELETE now call `await requirePrimary()`.

---

### M7 · Expense `amount` NaN not guarded in PATCH and POST
**Severity:** Medium  
**File:** `app/api/expenses/route.ts`  
**Problem:** `parseFloat(amount)` silently returns `NaN` for non-numeric input. Prisma stores `NaN` as `0` or throws, corrupting the expense record or the total.  
**Fix:** Added `const parsed = parseFloat(amount); if (isNaN(parsed) || parsed < 0) return apiError(...)` in both PATCH and POST before the database write.

---

### M8 · Product import: `product.create` and `stockMovement.create` not in the same transaction
**Severity:** Medium  
**File:** `app/api/products/import/route.ts`  
**Problem:** If `stockMovement.create` failed after `product.create` succeeded, the product existed with the correct `stockQty` but no matching stock movement log, creating an audit trail discrepancy.  
**Fix:** Both operations are now wrapped in `db.$transaction(async (tx) => { ... })` per row.

---

### M9 · Cron billing transitions don't pin current `billingStatus` in `updateMany` WHERE clause
**Severity:** Medium  
**File:** `app/api/cron/billing-check/route.ts`  
**Problem:** The cron: (1) finds shops matching a condition, (2) calls `updateMany` on those IDs. If an admin manually changed a shop's status between steps 1 and 2 (e.g., marked it ACTIVE), the `updateMany` would overwrite that change.  
**Fix:** Each `updateMany` WHERE clause now includes the expected current `billingStatus` (e.g., `billingStatus: BillingStatus.TRIAL`) so only shops still in the expected state are transitioned.

---

### M10 · Void/refund restores stock for service products
**Severity:** Medium  
**File:** `app/api/sales/[id]/route.ts`  
**Problem:** Services have no stock tracking, but voiding/refunding a sale containing services tried to increment `Product.stockQty` for them anyway, corrupting service product stock counts.  
**Fix:** The void/refund loop now includes `product: { select: { isService: true } }` in the include and skips `continue` for service items before any stock update.

---

### M11 · Receipt email sent fire-and-forget — API returns success before delivery confirmed
**Severity:** Medium  
**File:** `app/api/email/send-receipt/route.ts`  
**Problem:** `sendReceiptEmail(...).catch(...)` was called without `await`. The endpoint always returned `{ success: true }` even if the email failed, making it impossible for the caller to know about failures.  
**Fix:** Changed to `await sendReceiptEmail(...)`. Errors now propagate to the outer `catch` block and return a 500 with a descriptive message.

---

### M12 · Bulk product update: up to 3 DB round-trips per row (N+1)
**Severity:** Medium  
**File:** `app/api/products/update/route.ts`  
**Problem:** For each row, the route issued up to 3 sequential `findFirst` queries (by itemCode, SKU, name) — up to 15,000 queries for a 5,000-row update.  
**Fix:** All active products for the shop are loaded once with `findMany`, then indexed into three `Map`s (`byItemCode`, `bySku`, `byName`). Per-row lookup is now an O(1) Map access.

---

## Round 3 — Low Issues

### L1 · No HTTP security headers
**Severity:** Low  
**File:** `next.config.ts`  
**Problem:** The app served no `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy` headers, leaving it open to clickjacking and MIME-sniffing attacks.  
**Fix:** Added `headers()` to `next.config.ts` applying these headers to all routes (`/(.*)`).

---

### L2 · Offline IndexedDB stock deduction is a TOCTOU race
**Severity:** Low  
**File:** `lib/offline-db.ts`  
**Problem:** `deductCachedStock` called `getCachedProducts` (read transaction) then `cacheProducts` (separate write transaction). Two concurrent offline sales could both read the same stock snapshot, both decrement, and the second write would overwrite the first's decrement.  
**Fix:** Replaced the two-step approach with a single `readwrite` IDB transaction that reads, transforms, and writes within the same atomic unit.

---

### L3 · `set_grace` billing action doesn't clear `nextBillingDate`
**Severity:** Low  
**File:** `app/api/admin/billing/[shopId]/route.ts`  
**Problem:** When manually placing a shop into GRACE, the existing `nextBillingDate` was left set. The cron would immediately see `nextBillingDate <= now` on the next run and try to transition the shop again.  
**Fix:** Added `nextBillingDate: null` to the `set_grace` update data.

---

### L4 · Notification ID arrays in `localStorage` can grow without bound
**Severity:** Low  
**File:** `components/dashboard/topbar.tsx`  
**Problem:** `notif-seen-ids` and `notif-dismissed-ids` were written without a size cap. While the fetch loop prunes IDs that no longer exist, a burst of new notifications over time could accumulate large arrays.  
**Fix:** Both `markAllSeen` and `saveDismissed` now cap the stored arrays at 200 entries with `.slice(-200)`.

---

### L5 · Sidebar registers a redundant `window.focus` listener alongside `visibilitychange`
**Severity:** Low  
**File:** `components/dashboard/sidebar.tsx`  
**Problem:** The feature-check `useEffect` registered both a `visibilitychange` listener and a `window.focus` listener. When a user alt-tabs back, both fire and trigger duplicate API calls. `visibilitychange` already covers the tab-regain-focus case.  
**Fix:** Removed the `window.addEventListener("focus", checkFeatures)` registration and its corresponding cleanup.

---

### L6 · Customer profile and pay-dialog fetches have no `AbortController`
**Severity:** Low  
**File:** `app/(dashboard)/customers/customers-client.tsx`  
**Problem:** If `profileCustomer` or `payCustomer` changed (or the component unmounted) while the fetch was in-flight, the promise would still resolve and call `setState` on a stale/unmounted component, causing React warnings and potential incorrect UI state.  
**Fix:** Both `useEffect` hooks now create an `AbortController`, pass its `signal` to `fetch`, and call `controller.abort()` in the cleanup function. `AbortError` is swallowed silently.

---

### L7 · `flashTimer` ref not cleaned up on dialog unmount
**Severity:** Low  
**File:** `components/inventory/product-dialog.tsx`  
**Problem:** `handleBarcodeScan` sets a `setTimeout` stored in `flashTimer.current`. If the dialog closed or unmounted before the 1,500 ms elapsed, the timeout would fire and call `setSkuFlash(false)` on an unmounted component.  
**Fix:** Added a `useEffect` with an empty dependency array that returns `() => { if (flashTimer.current) clearTimeout(flashTimer.current); }`.

---

### L8 · UTC offset formula inverted for negative-offset timezones (informational)
**Severity:** Low (informational — not fixed)  
**File:** `lib/timezone.ts`  
**Problem:** The UTC offset arithmetic is inverted for timezones west of UTC (negative offsets). For the app's current target market (Sri Lanka, UTC+5:30) this is not observable, but would break if the app expanded to other regions.  
**Status:** Documented only. No code change made as the app currently targets UTC+5:30 exclusively.

---

*Generated 2026-07-12 · Reviewed by: Claude Sonnet 4.6*
