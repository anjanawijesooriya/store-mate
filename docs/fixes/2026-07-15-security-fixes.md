# Security Fixes — 2026-07-15

Two rounds of security review were conducted against the production codebase before launch. Seven confirmed vulnerabilities were identified and fixed across both passes.

---

## First Pass — 4 Fixes

### Fix S1 — Admin session cookie stored raw `ADMIN_SECRET`

**Files:** `app/api/admin/auth/route.ts`, `lib/admin-auth.ts`

**Problem:** The admin session cookie value was set to the literal `ADMIN_SECRET` environment variable. Any party who exfiltrated the cookie (device compromise, network snoop, future XSS) held a permanent admin credential valid for 30 days. Calling logout only cleared the client-side cookie — the stolen value remained valid until the env var was rotated. There was no per-session token, no server-side session record, and no revocation mechanism.

**Fix:** On login, a per-session token is generated as `uuid + "." + HMAC-SHA256(uuid, ADMIN_SECRET)`. The cookie stores this opaque value. Validation verifies the HMAC — the raw secret is never transmitted. Session lifetime reduced from 30 days to 24 hours to limit stolen-cookie exposure. Rotating `ADMIN_SECRET` immediately invalidates all existing sessions.

---

### Fix S2 — Backup export included all users' `passwordHash`

**File:** `lib/backup.ts`

**Problem:** The `exportAllData()` function explicitly selected `passwordHash: true` in its Prisma user query. The resulting JSON — containing bcrypt hashes for every user on the platform — was exported verbatim either as an email attachment or uploaded to Google Drive with no field stripping. If the email inbox or Drive account was compromised, an attacker received bcrypt hashes for all users across all shops, enabling offline dictionary attacks.

Secondary risk: the restore endpoint would write `passwordHash` back from any backup JSON that contained it. A malicious admin restoring a crafted backup could replace any user's password hash with a known-plaintext value, then log in as that user.

**Fix:** `passwordHash` removed from the user `select` query entirely. Hashes no longer leave the system via any backup path. Users reset their own passwords after a disaster-recovery restore.

---

### Fix S3 — HTML injection in outbound emails

**File:** `lib/mailer.ts`

**Problem:** Every user-controlled string — shop name, owner name, customer name, product names, item codes, warranty period, shop address, and the maintenance banner message — was interpolated raw into template-literal HTML strings passed to nodemailer. No HTML-entity escaping was applied anywhere. A shop owner setting their name to `</td><img src="https://tracker.evil.example/pixel.gif">` would inject that markup into every outbound email (receipts, low-stock alerts, credit reminders) sent to customers from the platform's own email address, enabling tracking pixel injection and phishing links.

**Fix:** Added `escHtml()` helper function and applied it to every interpolated user-controlled value across all 6 email functions (`sendPasswordResetOTP`, `sendLowStockEmail`, `sendDailySummaryEmail`, `sendReceiptEmail`, `sendMaintenanceEmail`, `sendCreditReminderEmail`).

```ts
function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
```

---

### Fix S4 — Password reset OTP brute-force via request cycling

**File:** `app/api/auth/forgot-password/route.ts`

**Problem:** The 6-digit numeric OTP (900,000 possibilities) had a per-token 5-attempt lockout on the reset endpoint. However, `forgot-password` had no rate limit and no account-level lockout. An attacker could cycle indefinitely: `POST /forgot-password` → receive fresh OTP token with a clean attempt counter → `POST /reset-password` with 5 guesses → repeat. This allowed unbounded guessing against the OTP space with no server-side blocking.

**Fix:** Added an account-level rate limit before a new OTP is issued: maximum 3 OTP requests per phone number per 15-minute window, counted against the `passwordResetToken` table. Exceeding the limit returns HTTP 429 and blocks further token issuance until the window expires.

---

## Second Pass — 3 Fixes

### Fix S5 — Restore endpoint: `shops` upsert had no field allowlist

**File:** `app/api/admin/restore/route.ts`

**Problem:** The `shops` upsert passed the raw backup record directly as `update: r as any, create: r as any` with no field allowlist. Any field present in the backup JSON flowed straight into Prisma — including `planTier`, `billingStatus`, `isLifetime`, `smsBalance`, `trialEndsAt`, and `nextBillingDate`. By contrast, the `users` upsert already had an explicit `pickUserFields()` allowlist; the shops upsert had none. An authenticated admin (or anyone who compromised the admin session) could POST a crafted backup targeting any shop's UUID and silently upgrade that shop's plan tier, disable billing locks, or inflate SMS balance.

**Fix:** Added `pickShopFields()` — an explicit field allowlist function mirroring `pickUserFields()` — that maps only known Shop schema fields to typed values with safe defaults. The shops upsert now passes `pickShopFields(r)` instead of `r as any`. No unknown or attacker-injected key can reach Prisma.

---

### Fix S6 — Sale creation: `customerId` not verified to belong to authenticated shop

**File:** `app/api/sales/route.ts`

**Problem:** When a sale was created with a `customerId`, all `productId` values were correctly validated against the shop (verified they belonged to `shopId`), but `customerId` was never checked. The customer update inside the transaction ran `tx.customer.update({ where: { id: customerId }, ... })` — a bare ID lookup with no `shopId` filter. An attacker authenticated to Shop A who knew or obtained a Customer UUID from Shop B could POST a sale with that foreign `customerId`, causing Shop B's customer record to have `totalSpent` incremented and, on a CREDIT payment, `creditBalance` inflated with Shop A's sale data.

**Fix:** Added a pre-transaction ownership check immediately after product validation:

```ts
if (customerId) {
  const customer = await db.customer.findFirst({ where: { id: customerId, shopId } });
  if (!customer) return apiError("Customer not found", 404);
}
```

---

### Fix S7 — Sale creation: `variantId` not verified to belong to submitted `productId`

**File:** `app/api/sales/route.ts`

**Problem:** When a sale item included a `variantId`, the stock check inside the transaction used `tx.productVariant.findUnique({ where: { id: item.variantId } })` with no `productId` or `shopId` filter. The product ownership check confirmed that `productId` belonged to the shop, but `variantId` was never tied back to that product. An attacker in Shop A could pair a valid Shop A `productId` (passing the ownership check) with a Shop B `variantId` (used for the actual stock read and decrement). The shop-isolation check on products was completely bypassed at the variant level, allowing a Shop A user to drain inventory from any Shop B variant whose UUID they knew. This was the same class of bug previously fixed in the exchange route.

**Fix:** Replaced the bare `findUnique` with a `findFirst` that constrains by both `id` and `productId`:

```ts
const fresh = await tx.productVariant.findFirst({
  where: { id: item.variantId, productId: item.productId },
  select: { stockQty: true },
});
if (!fresh) throw new Error(`Variant not found for ${item.productName}`);
```

If the variant does not belong to the stated product (including any cross-tenant attempt), the transaction throws and the sale is rejected.

---

## Files changed

| Fix | File | Category |
|-----|------|----------|
| S1 | `app/api/admin/auth/route.ts`, `lib/admin-auth.ts` | Insecure session |
| S2 | `lib/backup.ts` | Sensitive data export |
| S3 | `lib/mailer.ts` | HTML injection |
| S4 | `app/api/auth/forgot-password/route.ts` | Auth brute-force |
| S5 | `app/api/admin/restore/route.ts` | Privilege escalation |
| S6 | `app/api/sales/route.ts` | IDOR / cross-tenant |
| S7 | `app/api/sales/route.ts` | IDOR / cross-tenant |
