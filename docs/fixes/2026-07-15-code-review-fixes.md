# Code Review Fixes — 2026-07-15

Eight confirmed findings from the code review were fixed across six files.

---

## Fix 1 — Exchange route: variantId cross-shop validation

**File:** `app/api/sales/[id]/exchange/route.ts`

**Problem:** When processing an exchange, `newItems` in the request body could include a `variantId` that belonged to a different shop or a different product. The code queried the variant directly by its UUID inside the transaction with no ownership check, allowing a malicious actor to manipulate stock in another shop's inventory by guessing a variant UUID.

**Fix:** Added a pre-flight validation step before the transaction. Any `variantId` supplied in `newItems` is fetched with a join back to `Product.shopId` and cross-checked against both the stated `productId` and the authenticated `shopId`. A mismatch returns a 400 error before any stock operations begin.

---

## Fix 2 — Reports: COGS query was limited to top 10 products

**File:** `app/api/reports/route.ts`

**Problem:** The combined `cogsAndTopProducts` query had `LIMIT 10` applied, meaning `totalCOGS` was only the sum of cost for the top 10 revenue products — not all products sold in the period. This caused an understated COGS figure on the reports page.

**Fix:** Split into two independent queries:
- **COGS query** (unbounded): `SUM(quantity × costPrice)` across all products sold in the period — no `GROUP BY`, no `LIMIT`.
- **Top products query** (display only): `GROUP BY productId, name ORDER BY revenue DESC LIMIT 10` — used only for the top-products table on the UI.

---

## Fix 3 — Reports: salesByDay bucketed in UTC instead of local time

**File:** `app/api/reports/route.ts`

**Problem:** `DATE("createdAt")::text` extracts the calendar date in UTC. For Sri Lanka (UTC+5:30), sales made between midnight and 5:30 AM local time were counted on the previous day's bar in the chart.

**Fix:** Changed to `DATE(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Colombo')::text` so the date boundary matches the local calendar day.

---

## Fix 4 — Reports: hourlyData bucketed in UTC instead of local time

**File:** `app/api/reports/route.ts`

**Problem:** `EXTRACT(HOUR FROM "createdAt")` extracts the hour in UTC. This shifted the entire hourly sales chart 5.5 hours earlier than the actual local transaction time, making the peak-hour analysis wrong.

**Fix:** Changed to `EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Colombo')` so hours reflect local time.

---

## Fix 5 — Reports: catch block swallowed the unauthorized reason

**File:** `app/api/reports/route.ts`

**Problem:** The catch block called `apiUnauthorized()` with no arguments when an `UnauthorizedError` was thrown. This meant a `non_primary` device error (which should return HTTP 403) was returned as HTTP 401 with no reason, making it indistinguishable from a missing session.

**Fix:** Changed to `apiUnauthorized(err.reason)` so the correct HTTP status and reason string are forwarded to the client.

---

## Fix 6 — GRN confirm: non-deterministic cost update when same product appears twice

**File:** `app/api/grn/[id]/confirm/route.ts`

**Problem:** If a GRN contained two line items for the same product (e.g., two variants), both with `updateCost = true` but different unit costs, the `costPrice` was updated twice in the same transaction. The final value depended on whichever item happened to be processed last — non-deterministic and silent.

**Fix:** Added a `costUpdatedProducts = new Set<string>()` that is checked before each cost update. Only the first item for a given `productId` triggers the update; subsequent items for the same product are skipped.

---

## Fix 7 — Auth helpers: lastSeenAt update was a floating promise killed by Vercel

**File:** `lib/auth-helpers.ts`

**Problem:** The `lastSeenAt` update was fired as a floating promise with `.catch(() => {})`. On Vercel serverless, the function is torn down immediately after the response is sent, killing any unresolved promises. In practice `lastSeenAt` was rarely updated because the write was almost always terminated before it could complete.

**Fix:** Wrapped the update in `after()` from `next/server`. `after()` registers work to run after the response is flushed and keeps the serverless function alive until that work finishes.

---

## Fix 8 — Void/Refund: creditBalance decrement had no floor guard

**File:** `app/api/sales/[id]/route.ts`

**Problem:** When voiding or refunding a credit sale, `creditBalance: { decrement: creditToRestore }` was used. Under READ COMMITTED isolation, two concurrent void/refund requests for the same customer could both read the same `creditBalance`, both decrement by the full amount, and drive the balance negative.

**Fix:** Replaced the Prisma `decrement` with a raw SQL update:
```sql
UPDATE "Customer"
SET "creditBalance" = GREATEST(0::numeric, "creditBalance" - <amount>::numeric)
WHERE id = <customerId>
```
`GREATEST(0, ...)` floors the result at zero atomically in the database, making concurrent calls safe regardless of READ COMMITTED read ordering.

---

## Files changed

| File | Fixes applied |
|------|---------------|
| `app/api/sales/[id]/exchange/route.ts` | Fix 1 |
| `app/api/reports/route.ts` | Fix 2, 3, 4, 5 |
| `app/api/grn/[id]/confirm/route.ts` | Fix 6 |
| `lib/auth-helpers.ts` | Fix 7 |
| `app/api/sales/[id]/route.ts` | Fix 8 |
