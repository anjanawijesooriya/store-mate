# StoreMate — Smart Shop Manager

A full-stack SaaS POS and inventory management system built for small retail shops in Sri Lanka. Handles sales, inventory, customers, expenses, receipts, SMS/email notifications, and automated database backups.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + React + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL (Neon) via Prisma ORM |
| Auth | NextAuth.js (JWT sessions) |
| SMS | Notify.lk |
| Email | Nodemailer (Gmail SMTP) |
| Drive backup | Google Drive API (OAuth2) |
| Excel | XLSX (SheetJS) |
| Charts | Recharts |
| Hosting | Vercel |

---

## Features

### Point of Sale (POS)
- Product search by name or barcode scan
- Cart with quantity adjusters and per-line price override
- Cart-level discount (flat or %)
- Payment methods: Cash, Card, Online, Credit
- Card surcharge: optional percentage fee applied to card payments (admin-enabled per shop)
- Change calculator for cash payments
- Hold/resume multiple carts
- One-click complete sale — atomically creates Sale + SaleItems, decrements stock, logs StockMovements
- Receipt in four forms: print (80mm thermal), on-screen modal, email, shareable link (`/r/[saleId]`)
- Item code shown on all receipt types

### Inventory
- Product CRUD with fields: name, item code, SKU/barcode, category, unit, cost price, sell price, stock qty, low stock threshold, warranty period, service flag
- Alphabetical listing at all times (DB-level `ORDER BY LOWER(name)` + client-side `localeCompare` fallback)
- Low-stock and out-of-stock badges
- Stock adjustment with reason note
- Barcode scan to find/add products
- **Import Excel** — two modes:
  - *Add New Products*: bulk-create up to 5,000 products per file; BASIC plan hard-blocked at 500 product limit
  - *Update Existing*: bulk-update prices/details by matching on item code → SKU → name; only provided columns are changed; other fields untouched
- **Export Excel** — downloads current inventory as `.xlsx` with same column layout as the import template
- Downloadable sample template with correct Item Code column

### Sales History
- Full sale list with filters (date range, payment method, status)
- Sale detail view with line items, discounts, card fees, customer info
- Void and refund flows (restores stock)
- Exchange flow

### Reports & Dashboard
- Dashboard home: today's sales, week/month totals, low-stock count, top products, 7/30-day chart
- Detailed reports: by product, by payment method, by hour, profit estimate (sell − cost)
- Card fee P&L: reports include card surcharge revenue and expense breakdown
- P&L summary: revenue, COGS, gross profit, expenses, net profit
- Daily summary export (PDF/CSV)
- End-of-day cash reconciliation

### Customer Management
- Customer CRUD (name, phone, email, address)
- Attach customer to sale from POS screen
- Per-customer purchase history and lifetime spend
- Credit/account balance tracking (buy on credit, record payments)
- Receipt sharing via email/SMS to customer's phone

### Expense Tracking
- Log expenses by category (Rent, Utilities, Wages, Supplies, Other)
- Optional receipt photo upload
- Monthly P&L view combining sales and expenses

### SMS & Email Notifications
- Low stock alerts (daily digest, configurable threshold)
- Daily sales summary to shop owner
- Receipt email to customer
- Billing reminders
- Per-shop notification toggles (SMS and email separately)
- SMS balance tracking per shop

### Billing & Subscriptions
- Plan tiers: BASIC / STANDARD / PREMIUM
- Trial → Active → Grace → Locked lifecycle
- Lifetime plan option with annual maintenance payment model
- Admin panel: mark-as-paid, plan upgrade, grace period extension
- In-app billing status page for shop owners

### Database Backups
- **Google Drive (primary)**: uploads gzip-compressed JSON backup to Drive; auto-creates `daily/`, `weekly/`, `manual/` subfolders; keeps last 7 daily / 4 weekly / 5 manual files and permanently deletes older ones
- **Email attachment (fallback)**: if Drive is not configured, sends JSON attachment via SMTP
- Backup types: `daily`, `weekly`, `manual` (manual triggerable from admin UI)
- Notification email sent on success with Drive link, original vs compressed size
- Failure alert email sent if backup fails
- History table in admin UI with file name, size, type, status, and clickable Drive link
- Cron-triggered via external scheduler (GitHub Actions, cron-job.org) using `BACKUP_CRON_SECRET` header

### Admin Panel
- Shop list with plan tier, billing status, trial/payment dates
- Manual mark-as-paid, plan change, maintenance payment recording
- Maintenance banner (toggle per-shop broadcast message)
- Card surcharge enable/disable and rate configuration per shop
- Backup management: trigger backups, view history, see Drive/email status badges

---

## Environment Variables

Create `.env.local` at the project root:

```env
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# Admin access
ADMIN_PHONE=+94XXXXXXXXX

# SMS (Notify.lk)
NOTIFYLK_USER_ID=...
NOTIFYLK_API_KEY=...
NOTIFYLK_SENDER_ID=StoreMate

# Email (Gmail SMTP)
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
BACKUP_EMAIL=backup-destination@gmail.com   # optional, defaults to SMTP_USER

# Google Drive Backup
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...          # obtained via scripts/get-drive-token.js
GOOGLE_DRIVE_FOLDER_ID=...        # ID of the parent Drive folder for backups

# Backup cron (for external cron callers)
BACKUP_CRON_SECRET=...
```

---

## Google Drive Backup Setup

Run this once to get your OAuth2 refresh token:

```bash
node scripts/get-drive-token.js
```

Prerequisites:
1. Create an OAuth2 client in Google Cloud Console (Application type: Web application)
2. Add `http://localhost:9999/callback` as an Authorized Redirect URI
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local` first
4. Run the script — it opens the auth URL, captures the callback, and prints `GOOGLE_REFRESH_TOKEN=...`
5. Copy that token into `.env.local`
6. Set `GOOGLE_DRIVE_FOLDER_ID` to the ID of a Google Drive folder the authorized account can write to

The refresh token does not expire unless access is revoked. Re-run the script only if you need to change accounts.

---

## Getting Started

```bash
npm install
npx prisma generate
npx prisma db push      # or npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/
  (auth)/          — login, register, password reset
  (dashboard)/     — POS, inventory, sales, reports, customers, expenses, settings
  (admin)/         — admin panel, backup management
  api/             — all API routes
  r/[saleId]/      — public shareable receipt page
components/
  inventory/       — import-dialog, export, product form
  pos/             — cart, receipt, payment modal
  ui/              — shadcn/ui components
lib/
  backup.ts        — runBackup(), Drive + email logic
  google-drive.ts  — uploadToDrive(), cleanup, isDriveConfigured()
  mailer.ts        — sendReceiptEmail(), backup emails
  sms.ts           — sendSms() via Notify.lk
  auth.ts          — session helpers
  db.ts            — Prisma singleton
prisma/
  schema.prisma
scripts/
  get-drive-token.js   — one-time OAuth2 token helper
```

---

## Excel Import/Export

### Import template columns (order matters)
`Name | Item Code | SKU/Barcode | Category | Unit | Cost Price | Sell Price | Stock Qty | Low Stock At | Warranty Period`

Download the sample template from the Import dialog.

### Import limits
| Plan | Max products | Behaviour when at limit |
|---|---|---|
| BASIC | 500 | Hard block — 403 returned, no rows imported |
| STANDARD | 5,000 per file | Partial import allowed up to plan limit |
| PREMIUM | 5,000 per file | No per-shop limit enforced |

### Update mode
Select *Update Existing* in the import dialog to bulk-update prices or details without touching other fields. Products are matched by item code first, then SKU, then name (case-insensitive). Only columns present in the file are updated.

---

## Card Surcharge

Enabled per-shop by admin (`Shop.cardSurchargeEnabled`, `Shop.cardSurchargeRate`). When enabled:
- A configurable percentage fee is added to card payments in the POS
- The fee is shown on receipt and stored in `Sale.cardFee` / `Sale.cardFeeRate`
- Reports include card fee as a separate P&L line

---

## Backup Storage Management

Drive cleanup runs automatically after every upload. Retention limits:
- Daily backups: keep last **7**
- Weekly backups: keep last **4**
- Manual backups: keep last **5**

Files beyond the limit are permanently deleted from Drive (not moved to trash).
