# Small Business Management SaaS — Development Guide

**Product working name:** *DukaPola* (you can rename this later — "duka" means shop, "pola" suggests a marketplace/bustling business; feel free to swap for your own brand)
**Target market:** Grocery shops, clothing shops, pharmacies, hardware stores (Sri Lanka, SME segment)
**Pricing:** LKR 2,000–5,000/month per shop, tiered by features/usage
**Goal at 50 customers:** LKR 150,000/month recurring revenue

This guide takes you from zero to a paying-customer-ready product, phase by phase. Each phase has a clear exit criteria — don't move to the next phase until the current one is genuinely done, even if it's tempting to jump ahead.

---

## Table of Contents

1. [Strategy & Scope Before You Code](#1-strategy--scope-before-you-code)
2. [Tech Stack Decision](#2-tech-stack-decision)
3. [Design System — Themes, Fonts, Colors](#3-design-system--themes-fonts-colors)
4. [Phase 0 — Setup & Architecture](#phase-0--setup--architecture-week-1)
5. [Phase 1 — Core Auth & Multi-Tenancy](#phase-1--core-auth--multi-tenancy-week-2)
6. [Phase 2 — Inventory Management](#phase-2--inventory-management-weeks-3-4)
7. [Phase 3 — POS (Point of Sale)](#phase-3--pos-point-of-sale-weeks-5-6)
8. [Phase 4 — Sales Reports & Dashboard](#phase-4--sales-reports--dashboard-week-7)
9. [Phase 5 — Customer Management](#phase-5--customer-management-week-8)
10. [Phase 6 — Expense Tracking](#phase-6--expense-tracking-week-9)
11. [Phase 7 — SMS Notifications](#phase-7--sms-notifications-week-10)
12. [Phase 8 — Billing & Subscriptions](#phase-8--billing--subscriptions-week-11)
13. [Phase 9 — Polish, Offline Support, PWA](#phase-9--polish-offline-support-pwa-week-12)
14. [Phase 10 — Beta Launch & First 10 Customers](#phase-10--beta-launch--first-10-customers-weeks-13-14)
15. [Phase 11 — Scale to 50 Customers](#phase-11--scale-to-50-customers-ongoing)
16. [Database Schema Reference](#database-schema-reference)
17. [Pricing & Packaging Suggestion](#pricing--packaging-suggestion)
18. [Common Pitfalls in This Market](#common-pitfalls-in-this-market)

---

## 1. Strategy & Scope Before You Code

Before writing a line of code, lock down these decisions — changing them mid-build is expensive.

### 1.1 Pick ONE vertical to launch first
Grocery, clothing, pharmacy, and hardware shops all need POS + inventory, but their inventory models differ:

| Vertical | Inventory complexity | Special needs |
|---|---|---|
| Grocery | High SKU count, weight-based items (rice, sugar by kg) | Barcode scanning, expiry dates |
| Pharmacy | Batch/expiry tracking, regulatory | Drug schedules, expiry alerts, prescription log (maybe) |
| Clothing | Size/color variants per SKU | Variant matrix (S/M/L × colors) |
| Hardware | Long-tail SKUs, low turnover items | Unit conversions (box vs piece) |

**Recommendation:** Launch with **grocery + general retail** first (simplest model: SKU, price, quantity, no/simple variants). Add variant support (clothing) and batch/expiry (pharmacy) as Phase 2 features once you have paying customers validating the core. Don't try to serve all four verticals equally in v1 — you'll build a mediocre product for everyone instead of a great one for one segment.

### 1.2 Decide build vs. buy for hard parts
- **Payment collection from YOUR customers** (the shop owners paying you LKR 2,000–5,000/month): use a payment gateway, don't build this yourself. In Sri Lanka: PayHere, Genie (Dialog), or direct bank transfer + manual invoice for the first 10–20 customers (totally fine at this scale).
- **SMS to send to shop owners' customers** (e.g. "your order is ready"): use a local SMS gateway API — Dialog, Mobitel, Hutch all have bulk SMS APIs, or aggregators like Notify.lk which are built specifically for the Sri Lankan market and are easier to integrate than carrier-direct APIs.
- **Receipt printing**: most small shops use thermal receipt printers (58mm/80mm). You'll print via the browser's print dialog formatted for thermal width, or integrate with ESC/POS printer libraries later. Don't build native printer drivers in v1 — browser print-to-thermal works fine.

### 1.3 Define your MVP feature cut precisely
From your feature list, here's the suggested MVP (Phases 0–8) vs. later additions:

**MVP (must have to charge money):**
- POS (sell items, take cash/card, print/share receipt)
- Inventory (add/edit products, stock levels, low-stock alerts)
- Sales reports (daily/weekly/monthly, basic)
- Customer management (basic CRM — name, phone, purchase history)
- Expense tracking (basic — category, amount, date)
- SMS notifications (low stock alert to owner, optional receipt SMS to customer)

**Defer to post-launch (v1.1+):**
- Multi-branch support
- Staff accounts with permission levels (cashier vs owner)
- Supplier/purchase order management
- Loyalty points
- Variant matrix for clothing
- Batch/expiry for pharmacy
- Accounting integration / VAT reports

This guide builds the MVP list above across Phases 0–8, then polish/launch in 9–10.

---

## 2. Tech Stack Decision

Given this is likely a solo founder or very small team building fast, optimizing for **development speed, hiring pool, and low infra cost**:

### Recommended Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 14 (App Router) + React + TypeScript** | One codebase for web app, SSR for fast loads, huge ecosystem |
| Styling | **Tailwind CSS** | Fast to build consistent UI, easy to theme |
| UI components | **shadcn/ui** | Free, accessible, easy to customize, looks professional out of the box |
| Backend | **Next.js API routes** (or separate Node/Express if you expect to scale backend independently later) | No separate backend needed initially — ships faster |
| Database | **PostgreSQL** (hosted: Supabase, Neon, or Railway) | Relational data (orders, inventory) fits SQL much better than NoSQL |
| ORM | **Prisma** | Type-safe queries, easy migrations, great with Postgres |
| Auth | **NextAuth.js / Auth.js**, or Supabase Auth if using Supabase | Don't build auth from scratch |
| File/image storage | **Supabase Storage** or **Cloudflare R2** | Product images, logos |
| SMS | **Notify.lk** or **Dialog/Mobitel Bulk SMS API** | Local providers, LKR pricing, no forex issues |
| Payments (subscriptions) | **PayHere** (Sri Lanka) | Built for LK businesses, supports recurring billing |
| Hosting | **Vercel** (frontend+API) + **Supabase/Neon** (DB) | Generous free tiers, scales automatically, minimal devops |
| PWA / Offline | **next-pwa** or Workbox | So POS works with flaky internet |

### Why this stack for YOUR situation
- **Single codebase** (Next.js full-stack) = you or a small team can move fast without juggling two repos/deployments.
- **Postgres + Prisma** = inventory/sales data is inherently relational (orders have line items, products belong to categories, customers have purchase history) — SQL is the right tool, not Firebase/Mongo.
- **Vercel free/hobby tier** covers you until you have real paying traffic; Supabase free tier covers DB + auth + storage for your first ~20-30 shops easily.
- **Everything here has either Sinhala/Tamil community usage already** or is mainstream enough that local devs (if you hire later) will know it.

### Alternative if you want even faster MVP (no-code-ish)
If you want to validate demand even before custom dev: **Loyverse** or **Vend-style** white-label isn't an option (can't resell), but you could prototype the UX in **Bubble.io** to test with 2–3 real shops before committing to custom code. Not required, but worth knowing it exists if you want to de-risk before investing weeks of dev time.

---

## 3. Design System — Themes, Fonts, Colors

Your users are shop owners — often not tech-savvy, sometimes older, working in bright physical retail environments, frequently glancing at screens between serving customers. Design for **clarity and speed**, not trendiness.

### 3.1 Design Principles
1. **Big tap targets.** Many shop owners use this on tablets or budget Android phones, sometimes with greasy/gloved hands (hardware stores!). Minimum 44px touch targets.
2. **High contrast.** Shops have bright fluorescent lighting and glare. Avoid low-contrast gray-on-white trends.
3. **Numbers are king.** Prices, quantities, totals must be unmistakably legible — use tabular/monospaced figures for numbers so columns align.
4. **Sinhala/Tamil support from day one.** Even if UI is English-first, product names, customer names will often be in Sinhala/Tamil. Pick fonts that render these scripts properly.
5. **Minimal cognitive load.** One primary action per screen. The cashier should never wonder "what do I press now?"

### 3.2 Color Palette

A trustworthy, calm palette that doesn't fatigue the eye over an 8-hour shift, with a strong accent for primary actions (the "Charge/Sell" button needs to pop).

```
PRIMARY (brand/trust)
--primary-900: #0F3D2E   (deep green — money, growth, trust)
--primary-700: #1B7A4D
--primary-500: #2DA86B   (main brand color)
--primary-100: #E3F5EB   (light backgrounds, success states)

ACCENT (primary actions — "Sell", "Save", "Confirm")
--accent-700: #C2410C
--accent-500: #EA580C    (warm orange — energetic, draws eye to CTA)
--accent-100: #FFEDD5

NEUTRALS (text, backgrounds, borders)
--gray-900: #111827   (primary text)
--gray-700: #374151   (secondary text)
--gray-500: #6B7280   (placeholder/disabled)
--gray-200: #E5E7EB   (borders)
--gray-50:  #F9FAFB   (page background)
--white:    #FFFFFF   (card/surface background)

SEMANTIC
--success:  #16A34A   (stock OK, payment success)
--warning:  #D97706   (low stock)
--danger:   #DC2626   (out of stock, errors, delete actions)
--info:     #2563EB   (informational banners)
```

**Why green + orange:** Green signals money/growth/"go" (familiar from POS systems globally) without being a generic "tech blue." Orange as the accent for the Sell/Confirm button creates strong visual hierarchy — your cashiers' eyes go straight to the button that matters. Avoid using red as a primary brand color even though "danger" red is used for stock alerts — you don't want the overall app to feel alarming.

### 3.3 Typography

```
Primary UI font:     Inter (Google Fonts) — excellent legibility, free, wide language support
Sinhala/Tamil text:  Noto Sans Sinhala / Noto Sans Tamil (Google Fonts) — pair these
                      automatically when rendering user-entered names/products
Numbers/Receipts:    Roboto Mono or "Inter" with tabular-nums feature enabled
                      (for price columns, totals — keeps decimal points aligned)
```

```css
/* Tailwind config snippet */
fontFamily: {
  sans: ['Inter', 'Noto Sans Sinhala', 'Noto Sans Tamil', 'sans-serif'],
  mono: ['Roboto Mono', 'monospace'],
}
```

**Font sizing (mobile-first, since many cashiers use phones/tablets):**

| Use | Size | Weight |
|---|---|---|
| Page title | 24px | 700 |
| Section header | 18px | 600 |
| Body text | 15px | 400 |
| Price/Total (POS screen) | 32–40px | 700 |
| Button label | 16px | 600 |
| Small/meta text | 13px | 400 |

### 3.4 Theming Approach (light/dark + future white-labeling)

Build with CSS variables from day one so you can:
- Offer a dark mode (some shops run POS at night counters with dim lighting)
- White-label the color scheme per customer later if you ever offer a premium "branded" tier (e.g. a pharmacy chain wants their own logo/colors)

```css
:root {
  --bg-page: #F9FAFB;
  --bg-surface: #FFFFFF;
  --text-primary: #111827;
  --brand-primary: #2DA86B;
  --brand-accent: #EA580C;
}
[data-theme="dark"] {
  --bg-page: #0B0F0D;
  --bg-surface: #151A18;
  --text-primary: #F3F4F6;
  --brand-primary: #34D399;
  --brand-accent: #FB923C;
}
```

Use Tailwind's `dark:` variants mapped to these, or shadcn/ui's built-in theme provider (it already does exactly this pattern).

### 3.5 Iconography
Use **Lucide icons** (pairs natively with shadcn/ui, free, consistent stroke width). Keep icons paired with text labels for primary nav — icon-only nav is a common source of confusion for less tech-savvy users.

### 3.6 Component style notes
- **Buttons**: rounded-lg (8px radius), generous padding (`py-3 px-6` for primary actions), solid fill for primary, outline for secondary.
- **Cards**: subtle shadow (`shadow-sm`), 1px border in `--gray-200`, rounded-xl (12px).
- **Tables** (inventory lists, sales history): zebra striping optional but helpful at this density; sticky header row when scrolling.
- **Forms**: label above input (not placeholder-as-label — placeholders disappear and confuse less tech-savvy users), clear inline validation messages in `--danger`.

---

## Phase 0 — Setup & Architecture (Week 1)

**Goal:** Project scaffolded, deployed to a live URL (even empty), CI/CD working, team can start building features immediately.

### Tasks
1. **Initialize repo**
   ```bash
   npx create-next-app@latest dukapola --typescript --tailwind --app --eslint
   cd dukapola
   npx shadcn@latest init
   ```
2. **Set up Postgres** — create project on Supabase or Neon. Get connection string.
3. **Install & configure Prisma**
   ```bash
   npm install prisma @prisma/client
   npx prisma init
   ```
4. **Set up environment variables** (`.env.local`):
   ```
   DATABASE_URL=postgresql://...
   NEXTAUTH_SECRET=...
   NEXTAUTH_URL=http://localhost:3000
   SMS_API_KEY=...
   PAYHERE_MERCHANT_ID=...
   ```
5. **Deploy skeleton to Vercel** — connect GitHub repo, confirm a "Hello World" page deploys successfully. Do this on day 1, not week 12 — you want your deployment pipeline battle-tested early.
6. **Set up project structure:**
   ```
   /app
     /(auth)/login
     /(auth)/register
     /(dashboard)/pos
     /(dashboard)/inventory
     /(dashboard)/reports
     /(dashboard)/customers
     /(dashboard)/expenses
     /(dashboard)/settings
     /api
       /auth
       /products
       /sales
       /customers
       /expenses
       /sms
   /components
     /ui          (shadcn components)
     /pos
     /inventory
     /shared
   /lib
     /db.ts        (Prisma client singleton)
     /auth.ts
     /sms.ts
   /prisma
     schema.prisma
   ```
7. **Define multi-tenancy strategy now** (don't defer this): every table that holds shop-specific data gets a `shopId` foreign key. All queries MUST filter by `shopId`. Decide this architecture before writing the schema in Phase 1 — retrofitting multi-tenancy onto an existing schema is painful.

### Exit Criteria
- [ ] Repo created, pushed to GitHub
- [ ] Deployed skeleton live on a Vercel URL
- [ ] Database connected and reachable from the deployed app
- [ ] `npx prisma studio` works locally against your dev DB

---

## Phase 1 — Core Auth & Multi-Tenancy (Week 2)

**Goal:** A shop owner can register, log in, and land on an empty dashboard scoped to their own shop. No other shop's data is visible to them, ever.

### Data model for this phase
```prisma
model Shop {
  id        String   @id @default(cuid())
  name      String
  ownerName String
  phone     String   @unique
  category  ShopCategory  // GROCERY, PHARMACY, CLOTHING, HARDWARE, OTHER
  address   String?
  planTier  PlanTier @default(BASIC)
  createdAt DateTime @default(now())
  users     User[]
  products  Product[]
  sales     Sale[]
  customers Customer[]
  expenses  Expense[]
}

model User {
  id        String   @id @default(cuid())
  shopId    String
  shop      Shop     @relation(fields: [shopId], references: [id])
  name      String
  phone     String   @unique
  passwordHash String
  role      Role     @default(OWNER)  // OWNER, CASHIER (cashier role comes Phase 9+)
  createdAt DateTime @default(now())
}

enum ShopCategory { GROCERY PHARMACY CLOTHING HARDWARE OTHER }
enum PlanTier { BASIC STANDARD PREMIUM }
enum Role { OWNER CASHIER }
```

### Tasks
1. **Registration flow**: shop name, owner name, phone number, category, password. Phone number as username (not email) — far more reliable for this customer segment in Sri Lanka, many shop owners don't check email regularly.
2. **OTP verification via SMS** on registration (using your SMS provider) — confirms the phone number is real and reachable, which matters since you'll use it for billing reminders and low-stock alerts later.
3. **Login**: phone + password.
4. **Session management**: NextAuth.js with JWT sessions, or Supabase Auth session if using Supabase end-to-end.
5. **Middleware**: every API route and dashboard page checks the session, extracts `shopId`, and scopes all DB queries to it. Write this as a reusable helper now:
   ```typescript
   // lib/auth.ts
   export async function getShopId(req: Request): Promise<string> {
     const session = await getServerSession();
     if (!session) throw new UnauthorizedError();
     return session.user.shopId;
   }
   ```
   Every single query in every API route should call this and filter `WHERE shopId = ?`. This is your most important security boundary — a bug here means one shop sees another shop's sales data.
6. **Empty dashboard shell**: sidebar nav (POS, Inventory, Reports, Customers, Expenses, Settings), top bar with shop name + logout.

### Exit Criteria
- [ ] Can register a new shop and receive OTP via real SMS
- [ ] Can log in/out
- [ ] Two test shops created — confirm Shop A absolutely cannot see Shop B's (empty) data via any API route, including by manually trying to query another shop's ID
- [ ] Dashboard shell renders with your color/font theme from Section 3

---

## Phase 2 — Inventory Management (Weeks 3–4)

**Goal:** Shop owner can add products, track stock levels, and get warned when stock is low. This is the foundation the POS in Phase 3 depends on, so get it right before moving on.

### Data model for this phase
```prisma
model Product {
  id          String   @id @default(cuid())
  shopId      String
  shop        Shop     @relation(fields: [shopId], references: [id])
  name        String
  sku         String?           // barcode or shop's own code
  category    String?           // free text or link to Category model later
  unit        String   @default("pcs")  // pcs, kg, g, l, ml, box
  costPrice   Decimal  @db.Decimal(10,2)
  sellPrice   Decimal  @db.Decimal(10,2)
  stockQty    Decimal  @db.Decimal(10,2) @default(0)
  lowStockAt  Decimal  @db.Decimal(10,2) @default(5)
  imageUrl    String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([shopId])
  @@unique([shopId, sku])
}

model StockMovement {
  id         String   @id @default(cuid())
  productId  String
  product    Product  @relation(fields: [productId], references: [id])
  type       MovementType  // SALE, RESTOCK, ADJUSTMENT, RETURN
  quantity   Decimal  @db.Decimal(10,2)   // negative for deductions
  note       String?
  createdAt  DateTime @default(now())
}

enum MovementType { SALE RESTOCK ADJUSTMENT RETURN }
```

**Why a separate `StockMovement` table instead of just updating `Product.stockQty` directly:** you need an audit trail. Shop owners WILL ask "why does my stock say 3 but I think I had 10" — without movement history you can't answer that. Always write a movement row, then update the cached `stockQty` on the product in the same transaction.

### Tasks
1. **Product CRUD**: add/edit/delete (soft-delete via `isActive`, never hard-delete — sales history references products).
2. **Bulk import via CSV/Excel** — critical for onboarding. A shop owner with 200+ SKUs will not manually type each one. Build a CSV upload that maps columns to `name, sku, costPrice, sellPrice, stockQty, unit`.
3. **Barcode support**: allow scanning via phone camera (use a library like `html5-qrcode` or `react-qr-barcode-scanner`) to look up or add products by barcode. Most grocery/pharmacy stock has barcodes already printed.
4. **Low stock dashboard widget**: list of products where `stockQty <= lowStockAt`.
5. **Manual stock adjustment screen**: for stock takes/corrections, with a required "note" field (so there's a reason logged for every adjustment).
6. **Category/unit picker**: keep this simple — free-text category field with autocomplete from existing categories is enough for v1; don't build a full category tree yet.

### UI notes for this phase
- Product list: table view with image thumbnail, name, stock qty (color-coded: green=ok, amber=low, red=out), sell price. Searchable/filterable by name and category.
- "Add Product" should be reachable in one tap from anywhere in Inventory — this is a high-frequency action.
- Low stock items get a `--warning` colored badge; out of stock gets `--danger`.

### Exit Criteria
- [ ] Can add a product manually and via CSV bulk import
- [ ] Can scan a barcode to find/add a product
- [ ] Stock levels update correctly and StockMovement rows are created for every change
- [ ] Low stock list correctly reflects products under threshold

---

## Phase 3 — POS (Point of Sale) (Weeks 5–6)

**Goal:** A cashier can ring up a sale in under 30 seconds: search/scan products, add to cart, take payment, print/share receipt, and stock automatically decrements. This is the single most important screen in the entire product — it's used dozens of times a day, every day. Polish this more than any other screen.

### Data model for this phase
```prisma
model Sale {
  id          String   @id @default(cuid())
  shopId      String
  shop        Shop     @relation(fields: [shopId], references: [id])
  customerId  String?
  customer    Customer? @relation(fields: [customerId], references: [id])
  userId      String            // which cashier/owner processed it
  items       SaleItem[]
  subtotal    Decimal  @db.Decimal(10,2)
  discount    Decimal  @db.Decimal(10,2) @default(0)
  total       Decimal  @db.Decimal(10,2)
  paymentMethod PaymentMethod   // CASH, CARD, ONLINE, CREDIT
  amountPaid  Decimal  @db.Decimal(10,2)
  status      SaleStatus @default(COMPLETED)  // COMPLETED, REFUNDED, VOIDED
  createdAt   DateTime @default(now())

  @@index([shopId, createdAt])
}

model SaleItem {
  id         String   @id @default(cuid())
  saleId     String
  sale       Sale     @relation(fields: [saleId], references: [id])
  productId  String
  product    Product  @relation(fields: [productId], references: [id])
  quantity   Decimal  @db.Decimal(10,2)
  unitPrice  Decimal  @db.Decimal(10,2)  // snapshot price at sale time — NOT a live FK to current product price
  lineTotal  Decimal  @db.Decimal(10,2)
}

enum PaymentMethod { CASH CARD ONLINE CREDIT }
enum SaleStatus { COMPLETED REFUNDED VOIDED }
```

**Critical detail:** `SaleItem.unitPrice` must be a snapshot, copied at the moment of sale — never compute historical sales totals by joining to the live `Product.sellPrice`, because prices change over time and historical reports would silently become wrong.

### Tasks
1. **Product search/scan bar**: type-ahead search by name, or barcode scan, adds item to cart instantly. This is the highest-frequency interaction in the whole app — it must be near-instant (debounced search, results in <200ms).
2. **Cart panel**: line items with quantity steppers (+/-), per-line subtotal, running total in large bold text (use the 32–40px size from the design system).
3. **Manual quantity/price override**: cashiers occasionally need to adjust price (discount, damaged goods) — allow editable line price with a reason note, logged for the owner to review.
4. **Discount**: flat amount or percentage, applied at cart level.
5. **Payment screen**: select Cash / Card / Online / Credit (credit = "on account," common for regular customers at small shops — ties into Customer Management in Phase 5). For cash, show a quick change calculator (enter amount tendered, auto-compute change).
6. **Complete sale transaction**: on confirm, in a single DB transaction:
   - Create `Sale` + `SaleItem` rows
   - Decrement `Product.stockQty` for each item
   - Create `StockMovement` rows (type=SALE, negative quantity)
   - If customer attached, update their purchase history/total spend
7. **Receipt**: generate a receipt view formatted for 80mm thermal printer width, with shop name/logo, line items, total, date/time. Trigger browser print dialog (`window.print()` with a print-specific CSS media query), and also offer "Share via WhatsApp/SMS" as a soft-copy alternative (very commonly requested in this market — customers like a digital receipt sent to WhatsApp).
8. **Hold/resume sale**: allow cashier to "park" a cart and serve another customer, then resume (useful when a customer is still deciding).

### UI notes for this phase
- Split-screen layout: product search/grid on the left (60%), cart + total on the right (40%) — standard POS layout, optimized for landscape tablets, but must also work on a single-column mobile layout (stack cart below product grid, sticky "View Cart (3) — LKR 1,250" bar).
- The "Charge" button is the single biggest, most prominent element on the screen — full-width, `--accent-500` background, large bold white text.
- Recently/frequently sold items shown as a quick-tap grid above the search results — most shops sell the same 20-30 items most of the time.

### Exit Criteria
- [ ] Can complete a full sale: search → add to cart → adjust qty → apply discount → choose payment → confirm → see receipt
- [ ] Stock correctly decrements after sale, with StockMovement logged
- [ ] Receipt prints correctly on an actual 80mm thermal printer (test on real hardware, not just preview — thermal print CSS has its own quirks)
- [ ] A sale can be voided/refunded, and stock is correctly restored when it is
- [ ] Full sale flow completable in under 30 seconds by someone who's used the screen a few times

---

## Phase 4 — Sales Reports & Dashboard (Week 7)

**Goal:** Owner can answer "how is my business doing?" at a glance, and drill into specifics when needed.

### Tasks
1. **Dashboard home screen** (the first thing the owner sees on login):
   - Today's sales total, transaction count, compared to yesterday (▲/▼ %)
   - This week / this month totals
   - Low stock alert count (links to Inventory)
   - Top 5 selling products (this week)
   - Simple line/bar chart: sales over last 7/30 days
2. **Detailed reports screen** with filters:
   - Date range picker (today, this week, this month, custom range)
   - Sales by product (which items sell most/least — helps reorder decisions)
   - Sales by payment method (cash vs card vs credit breakdown — useful for cash reconciliation at end of day)
   - Sales by hour-of-day (helps staffing decisions — when are the busy hours)
   - Profit estimate (sellPrice − costPrice across sold items) — this is a high-value feature shop owners often don't get elsewhere
3. **Export**: CSV/Excel export of any report, and a simple PDF "daily summary" the owner can save or share.
4. **End-of-day cash reconciliation view**: total cash sales vs. expected cash drawer amount — helps catch discrepancies early, very commonly requested by small shop owners managing cashiers.

### Charting
Use **Recharts** (works well in React, good defaults, easy to theme with your color palette) for the line/bar charts on the dashboard.

### Exit Criteria
- [ ] Dashboard loads in under 1 second with real data for a shop with 1000+ sales records (test with seeded data, not just a handful of test sales)
- [ ] All report filters produce correct, spot-checked numbers
- [ ] CSV export opens cleanly in Excel (check Sinhala/Tamil text doesn't get mangled by encoding — use UTF-8 BOM for CSV exports so Excel renders non-Latin scripts correctly)

---

## Phase 5 — Customer Management (Week 8)

**Goal:** Owner can track regular customers, their purchase history, and (if used) running credit/account balances.

### Data model for this phase
```prisma
model Customer {
  id            String   @id @default(cuid())
  shopId        String
  shop          Shop     @relation(fields: [shopId], references: [id])
  name          String
  phone         String?
  address       String?
  creditBalance Decimal  @db.Decimal(10,2) @default(0)  // positive = customer owes shop
  totalSpent    Decimal  @db.Decimal(10,2) @default(0)
  sales         Sale[]
  createdAt     DateTime @default(now())

  @@index([shopId])
}
```

### Tasks
1. **Customer CRUD**: add/edit, search by name or phone.
2. **Link customer to sale**: from the POS screen, optionally attach a customer to a transaction (search-as-you-type by phone/name).
3. **Purchase history view**: per-customer list of past sales, total lifetime spend.
4. **Credit/account tracking**: if a customer buys "on credit" (very common at small Sri Lankan shops — regular customers running a tab), track their running balance and allow the owner to record payments against it.
5. **Customer-facing receipt sharing**: send receipt via SMS/WhatsApp link using the customer's stored phone number (ties into Phase 7).

### Exit Criteria
- [ ] Can add/search customers from the POS screen mid-sale without leaving the flow
- [ ] Credit balance correctly increases on credit sales and decreases on recorded payments
- [ ] Purchase history per customer is accurate and matches sales records

---

## Phase 6 — Expense Tracking (Week 9)

**Goal:** Owner can log business expenses (rent, utilities, supplier payments, wages) to see true profit, not just sales revenue.

### Data model for this phase
```prisma
model Expense {
  id         String   @id @default(cuid())
  shopId     String
  shop       Shop     @relation(fields: [shopId], references: [id])
  category   String           // Rent, Utilities, Supplies, Wages, Other
  amount     Decimal  @db.Decimal(10,2)
  note       String?
  receiptUrl String?          // photo of receipt, optional
  expenseDate DateTime
  createdAt  DateTime @default(now())

  @@index([shopId, expenseDate])
}
```

### Tasks
1. **Expense entry form**: category (dropdown with common presets + custom), amount, date, optional note, optional photo of the receipt (upload to storage).
2. **Expense list/history**: filterable by category and date range.
3. **Profit & Loss summary**: combine Sales (Phase 4) revenue/profit numbers with Expenses to show a simple monthly P&L: `Revenue − COGS − Expenses = Net Profit`. This is a strong differentiator vs. basic POS apps that only track sales.

### Exit Criteria
- [ ] Can log an expense with photo attachment
- [ ] Monthly P&L view shows correct combined numbers from Sales + Expenses

---

## Phase 7 — SMS Notifications (Week 10)

**Goal:** Timely SMS alerts to shop owners (operational) and optionally to their customers (receipts/promotions).

### SMS Use Cases (in priority order)
1. **Low stock alert** to shop owner — daily digest or real-time when an item crosses threshold.
2. **OTP for login/registration** (already needed in Phase 1, formalize the provider integration here if not done).
3. **Daily sales summary** to shop owner (e.g. 9 PM SMS: "Today: 45 sales, LKR 32,500 revenue").
4. **Subscription/billing reminders** (ties into Phase 8 — "Your DukaPola subscription renews in 3 days").
5. **Customer-facing**: receipt SMS, "your order is ready" (optional, shop owner can toggle on/off per shop — adds to their SMS cost, so make sure pricing accounts for this, see Section 17).

### Provider setup
Sign up with **Notify.lk** (simplest local integration, sender ID approval process is straightforward) or go direct with **Dialog/Mobitel/Hutch APIs** if you want lower per-SMS cost at higher volume. Notify.lk is recommended to start — faster approval, simpler API, good enough pricing at your initial scale (50 shops × occasional SMS is low volume).

```typescript
// lib/sms.ts
export async function sendSms(to: string, message: string) {
  const res = await fetch('https://app.notify.lk/api/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: process.env.NOTIFYLK_USER_ID,
      api_key: process.env.NOTIFYLK_API_KEY,
      sender_id: process.env.NOTIFYLK_SENDER_ID,
      to,
      message,
    }),
  });
  return res.json();
}
```

### Tasks
1. Integrate provider, test sending to a real Sri Lankan number.
2. Build a notification queue/job (don't send SMS synchronously inside the request — use a simple background job, e.g. a Vercel Cron job that checks for low-stock conditions hourly, or a queue like Trigger.dev/Inngest for more reliability).
3. Per-shop SMS preferences screen (Settings): toggle which notification types are active, since SMS costs money per message and not every owner wants every type.
4. Track SMS usage per shop (for cost monitoring and potential future usage-based billing).

### Exit Criteria
- [ ] Real SMS successfully received on a test phone for: OTP, low-stock alert, daily summary
- [ ] SMS sending failures are logged and don't crash the triggering action (e.g. a sale still completes even if the receipt SMS fails to send)
- [ ] Per-shop notification toggles work correctly

---

## Phase 8 — Billing & Subscriptions (Week 11)

**Goal:** You can actually collect LKR 2,000–5,000/month from shops automatically (or semi-automatically).

### Tasks
1. **Define plan tiers** (see Section 17 for suggested pricing) — store on the `Shop.planTier` field already in your schema.
2. **Free trial**: 14 or 30-day free trial with full feature access, no credit card required up front — lowers friction for this customer segment who are wary of giving card details online. Track `trialEndsAt` on Shop.
3. **Payment integration**: Set up **PayHere** recurring billing for shops that want to pay by card. For your first 10–20 customers, it is completely reasonable to handle billing manually (send an invoice via WhatsApp, accept bank transfer/cash, mark as paid in an admin screen) — don't over-engineer automated billing before you have a handful of paying customers validating willingness to pay.
4. **Admin/internal billing screen** (only you can see this): list of all shops, plan tier, trial/payment status, next billing date, manual "mark as paid" action.
5. **Grace period & feature lock**: if payment lapses, give a 3–5 day grace period with a banner warning, then soft-lock POS (read-only access to view past data, but can't process new sales) until payment resumes. Never delete their data for non-payment — that's how you create very angry, vocal ex-customers in a small business community where word travels fast.
6. **In-app billing status page** for shop owners: current plan, next payment date, payment history/receipts.

### Exit Criteria
- [ ] A trial shop correctly transitions to "payment required" after trial ends
- [ ] Manual mark-as-paid flow works and correctly extends access
- [ ] PayHere test transaction completes successfully in sandbox mode

---

## Phase 9 — Polish, Offline Support, PWA (Week 12)

**Goal:** The app survives real-world conditions — patchy internet, power cuts, low-end Android devices — and feels fast and trustworthy.

### Tasks
1. **PWA setup**: installable on Android home screen (`next-pwa` or manual manifest + service worker), so it feels like a native app, not "a website."
2. **Offline POS mode**: this is important for your market. Many small shops, especially outside Colombo, have unreliable internet/power.
   - Cache the product catalog locally (IndexedDB) so the POS search/cart works fully offline.
   - Queue sales made offline; sync to the server when connection returns.
   - Show a clear "Offline — sales will sync when reconnected" banner so cashiers aren't confused about whether the sale "went through."
   - **Conflict handling**: if stock was sold both offline and online for the same item before sync, don't silently overwrite — flag for owner review if stock would go negative.
3. **Performance pass**: audit POS screen load time and search responsiveness specifically — this screen gets used the most, so it deserves the most performance budget. Target sub-second interactions on a mid-range Android phone (not just your dev machine).
4. **Loading states & skeleton screens** everywhere data loads, so the app never feels frozen on a slow connection.
5. **Error handling & empty states**: every list (inventory, sales, customers) needs a friendly empty state with a clear call-to-action, and every form needs graceful error messages (not raw API error text).
6. **Sinhala/Tamil UI translation** (optional for v1, but worth scoping): even a partial translation of key screens (POS, common buttons) can meaningfully widen your addressable market beyond English-comfortable owners.
7. **Onboarding flow**: first-login checklist ("Add your first product," "Make your first sale," "Set up SMS alerts") — guided setup massively improves activation for non-technical users who might otherwise abandon an empty dashboard.

### Exit Criteria
- [ ] App installs as a PWA on a real Android phone and opens like a native app
- [ ] A sale can be completed with WiFi/data fully disabled, and syncs correctly once reconnected
- [ ] New shop owner can complete onboarding checklist without external help
- [ ] Tested on at least one low-end Android device (not just a high-end phone or desktop browser)

---

## Phase 10 — Beta Launch & First 10 Customers (Weeks 13–14)

**Goal:** Real shops, real money, real feedback.

### Tasks
1. **Recruit 5–10 beta shops** — ideally from your own network first (relatives' shops, neighborhood shops you know personally). Offer first 1–2 months free in exchange for honest, frequent feedback.
2. **White-glove onboarding**: physically visit or video-call each beta shop, set up their product catalog with them, train the cashier directly. Do not expect a self-serve signup flow to work perfectly for this segment yet — the product isn't proven enough to skip hands-on onboarding.
3. **Daily check-ins for the first week** of each beta shop's usage — ask specifically: "Did anything confuse you today? Did anything feel slow? Did you have to call/message me for help?" Every "had to ask for help" moment is a UX gap to fix.
4. **Fix the top 3 recurring complaints** before expanding beyond beta — resist the urge to add new features during this phase; fix what's broken in what you have.
5. **Collect testimonials/case studies** from beta shops who get value — "Shop X saved 2 hours a day on stock-taking" is gold for converting your next 40 customers.
6. **Start charging beta shops** once free period ends, even at a discount — validates real willingness to pay, which is the whole point of beta.

### Exit Criteria
- [ ] 5–10 shops actively using the product daily for at least 2 weeks
- [ ] At least 3 of them have converted to paying (even at a discounted rate)
- [ ] You have a documented list of bugs/friction points found, and the top issues are fixed

---

## Phase 11 — Scale to 50 Customers (Ongoing)

**Goal:** Reach LKR 150,000/month — sustainable, repeatable growth.

### Growth tactics specific to this market
1. **Referral incentive**: shop owners know other shop owners (often literally next door, or through supplier/trade networks). Offer 1 free month for both referrer and referee.
2. **Local trade associations / supplier relationships**: pharmacies, hardware stores, and grocery shops often belong to or buy from common distributors/associations — partnering with a distributor who recommends your software to their retail customers can be a powerful channel.
3. **In-person demos at shop level**: this segment converts much better from a 15-minute in-person demo on their own counter than from a landing page alone, at least until you have a strong base of testimonials.
4. **WhatsApp Business as your support channel**: this customer segment overwhelmingly prefers WhatsApp over email/tickets for support — meet them there.
5. **Tiered pricing to expand average revenue per shop** (see Section 17) — a grocery shop with 500 SKUs and 3 cashiers has very different willingness-to-pay than a small clothing shop with 50 SKUs.
6. **Track churn closely**: at small scale, talk to every single shop that cancels and find out why — this is your highest-signal feedback channel.

### Operational tasks at this scale
- Set up basic monitoring/alerting (e.g. Sentry for error tracking, Vercel/Supabase built-in metrics) — you need to know if the app goes down before 50 shops tell you at once.
- Document a simple support runbook (common issues + fixes) so support doesn't all live in your head.
- Revisit Phase 1's deferred features (multi-branch, staff roles, variant matrix, batch/expiry) based on actual demand from your growing customer base — let real usage guide what you build next, not assumptions made before launch.

### Exit Criteria
- [ ] 50 paying shops, LKR 150,000+/month MRR
- [ ] Monthly churn rate tracked and trending stable or downward
- [ ] Support load is manageable without burning out (if not, this is your signal to hire your first support/success person)

---

## Database Schema Reference

Full consolidated Prisma schema combining all phases above — copy this as your starting `schema.prisma` and adjust as you go:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ShopCategory { GROCERY PHARMACY CLOTHING HARDWARE OTHER }
enum PlanTier { BASIC STANDARD PREMIUM }
enum Role { OWNER CASHIER }
enum MovementType { SALE RESTOCK ADJUSTMENT RETURN }
enum PaymentMethod { CASH CARD ONLINE CREDIT }
enum SaleStatus { COMPLETED REFUNDED VOIDED }

model Shop {
  id           String      @id @default(cuid())
  name         String
  ownerName    String
  phone        String      @unique
  category     ShopCategory
  address      String?
  planTier     PlanTier    @default(BASIC)
  trialEndsAt  DateTime?
  createdAt    DateTime    @default(now())
  users        User[]
  products     Product[]
  sales        Sale[]
  customers    Customer[]
  expenses     Expense[]
}

model User {
  id           String   @id @default(cuid())
  shopId       String
  shop         Shop     @relation(fields: [shopId], references: [id])
  name         String
  phone        String   @unique
  passwordHash String
  role         Role     @default(OWNER)
  createdAt    DateTime @default(now())
}

model Product {
  id          String          @id @default(cuid())
  shopId      String
  shop        Shop            @relation(fields: [shopId], references: [id])
  name        String
  sku         String?
  category    String?
  unit        String          @default("pcs")
  costPrice   Decimal         @db.Decimal(10,2)
  sellPrice   Decimal         @db.Decimal(10,2)
  stockQty    Decimal         @db.Decimal(10,2) @default(0)
  lowStockAt  Decimal         @db.Decimal(10,2) @default(5)
  imageUrl    String?
  isActive    Boolean         @default(true)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  movements   StockMovement[]
  saleItems   SaleItem[]

  @@index([shopId])
  @@unique([shopId, sku])
}

model StockMovement {
  id         String        @id @default(cuid())
  productId  String
  product    Product       @relation(fields: [productId], references: [id])
  type       MovementType
  quantity   Decimal       @db.Decimal(10,2)
  note       String?
  createdAt  DateTime      @default(now())
}

model Customer {
  id            String   @id @default(cuid())
  shopId        String
  shop          Shop     @relation(fields: [shopId], references: [id])
  name          String
  phone         String?
  address       String?
  creditBalance Decimal  @db.Decimal(10,2) @default(0)
  totalSpent    Decimal  @db.Decimal(10,2) @default(0)
  sales         Sale[]
  createdAt     DateTime @default(now())

  @@index([shopId])
}

model Sale {
  id            String        @id @default(cuid())
  shopId        String
  shop          Shop          @relation(fields: [shopId], references: [id])
  customerId    String?
  customer      Customer?     @relation(fields: [customerId], references: [id])
  userId        String
  items         SaleItem[]
  subtotal      Decimal       @db.Decimal(10,2)
  discount      Decimal       @db.Decimal(10,2) @default(0)
  total         Decimal       @db.Decimal(10,2)
  paymentMethod PaymentMethod
  amountPaid    Decimal       @db.Decimal(10,2)
  status        SaleStatus    @default(COMPLETED)
  createdAt     DateTime      @default(now())

  @@index([shopId, createdAt])
}

model SaleItem {
  id         String   @id @default(cuid())
  saleId     String
  sale       Sale     @relation(fields: [saleId], references: [id])
  productId  String
  product    Product  @relation(fields: [productId], references: [id])
  quantity   Decimal  @db.Decimal(10,2)
  unitPrice  Decimal  @db.Decimal(10,2)
  lineTotal  Decimal  @db.Decimal(10,2)
}

model Expense {
  id          String   @id @default(cuid())
  shopId      String
  shop        Shop     @relation(fields: [shopId], references: [id])
  category    String
  amount      Decimal  @db.Decimal(10,2)
  note        String?
  receiptUrl  String?
  expenseDate DateTime
  createdAt   DateTime @default(now())

  @@index([shopId, expenseDate])
}
```

---

## Pricing & Packaging Suggestion

Aligning with your stated LKR 2,000–5,000/month range:

| Tier | Price/month | Limits | Target shop |
|---|---|---|---|
| **Basic** | LKR 2,000 | 1 device login, up to 500 products, 1 cashier account | Very small shops, single counter |
| **Standard** | LKR 3,500 | Up to 3 device logins, unlimited products, 3 cashier accounts, SMS notifications included (up to 100/month) | Most grocery/clothing/hardware shops — likely your bulk |
| **Premium** | LKR 5,000 | Unlimited devices/cashiers, unlimited SMS, priority WhatsApp support, advanced reports | Pharmacies, multi-counter shops, larger grocery |

At 50 customers weighted toward Standard (your example math of LKR 3,000 average maps almost exactly to a Standard-heavy mix), you hit your LKR 150,000/month target. Consider **annual billing with a discount** (e.g. pay for 10 months, get 12) once you have product-market fit — improves your cash flow and reduces churn since owners commit longer.

**SMS cost note:** factor real SMS provider costs into your tier limits — at LK SMS rates, sending hundreds of messages per shop per month at LKR 3,500/month pricing could erode margin if unmetered. Cap included SMS volume per tier and clearly communicate overage handling (e.g. auto-disable non-critical SMS types if a shop's monthly quota is hit, never silently bill them extra without consent).

---

## Common Pitfalls in This Market

A few hard-won lessons specific to building for Sri Lankan small retail:

1. **Don't assume reliable internet.** Build offline-first from Phase 9, not as an afterthought — this is genuinely make-or-break for adoption outside major towns.
2. **Don't assume English comfort.** Even shop owners fluent in English often run their actual product catalog in Sinhala/Tamil (product names, customer names). Test your fonts and database collation with real Sinhala/Tamil text early, not at the end.
3. **Don't over-automate billing too early.** Manual WhatsApp invoicing for your first 10-20 customers is fine and lets you have a real relationship/feedback loop with early customers — automate once you understand your actual churn/payment patterns.
4. **Don't underestimate onboarding effort.** This customer segment is not used to software adoption — budget real human time (yours) for hands-on setup with each of your first 20-30 customers, not just your first 5.
5. **Price anchoring conversation matters more than the number itself.** LKR 2,000-5,000/month for a shop owner can sound expensive in isolation — frame it against time saved (manual stock-taking, manual ledger book reconciliation) or losses prevented (theft/shrinkage visibility from accurate stock tracking), not against "other software."
6. **Thermal printer quirks are real.** Test receipt printing on the actual cheap thermal printers commonly sold in Sri Lanka (often unbranded 80mm models) — browser print CSS for thermal width has real-world rendering quirks that differ printer to printer.
7. **Keep the POS screen fast above all else.** Every other screen can be a little slower without anyone caring much. POS speed directly affects how a cashier feels about the product, multiple times an hour, every single day they use it.

---

*End of guide. Suggested approach: treat each Phase as a one-to-two week sprint, and don't skip the "Exit Criteria" checklists — they exist specifically to stop scope creep from quietly turning a 12-week build into a 6-month one.*

