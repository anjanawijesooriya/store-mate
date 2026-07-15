-- ============================================================
-- Bridging migration: captures all schema changes applied via
-- `prisma db push` that were never written to a migration file.
-- Safe to run on both a clean shadow DB and the production DB.
-- ============================================================

-- ── New enums ────────────────────────────────────────────────

DO $$ BEGIN CREATE TYPE "PayType"      AS ENUM ('SALARY', 'HOURLY', 'DAILY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "RecordPeriod" AS ENUM ('DAY', 'WEEK', 'MONTH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "RecordStatus" AS ENUM ('PENDING', 'PAID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "DeductionType" AS ENUM ('EPF', 'ETF', 'ADVANCE', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ShopGroup ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ShopGroup" (
    "id"        TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopGroup_pkey" PRIMARY KEY ("id")
);

-- ── Shop — new columns ───────────────────────────────────────

-- Rename smsCredits → smsBalance only if the old name still exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'Shop' AND column_name = 'smsCredits')
  THEN
    ALTER TABLE "Shop" RENAME COLUMN "smsCredits" TO "smsBalance";
  END IF;
END $$;

-- The column was originally INTEGER (from smsMonthlyUsage); coerce to DECIMAL(10,2)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Shop'
      AND column_name = 'smsBalance'
      AND data_type NOT IN ('numeric', 'decimal')
  ) THEN
    ALTER TABLE "Shop" ALTER COLUMN "smsBalance" TYPE DECIMAL(10,2) USING "smsBalance"::DECIMAL(10,2);
    ALTER TABLE "Shop" ALTER COLUMN "smsBalance" SET DEFAULT 0;
  END IF;
END $$;

ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "smsBalance"               DECIMAL(10,2)  NOT NULL DEFAULT 0;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "emailLowStock"            BOOLEAN        NOT NULL DEFAULT true;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "emailDailySummary"        BOOLEAN        NOT NULL DEFAULT true;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "emailReceiptEnabled"      BOOLEAN        NOT NULL DEFAULT true;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "creditReminderEnabled"    BOOLEAN        NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "variantsEnabled"          BOOLEAN        NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "weightedProductsEnabled"  BOOLEAN        NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "cardSurchargeEnabled"     BOOLEAN        NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "cardSurchargeRate"        DECIMAL(5,4)   NOT NULL DEFAULT 0;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "branchModeEnabled"        BOOLEAN        NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "deviceLockEnabled"        BOOLEAN        NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "isLifetime"               BOOLEAN        NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "maintenanceDueDate"       TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "maintenancePaidUntil"     TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "payrollEnabled"           BOOLEAN        NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "shopGroupId"              TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "maintenanceBanner"        BOOLEAN        NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "maintenanceBannerMessage" TEXT;

DO $$ BEGIN
  ALTER TABLE "Shop" ADD CONSTRAINT "Shop_shopGroupId_fkey"
    FOREIGN KEY ("shopGroupId") REFERENCES "ShopGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Shop_shopGroupId_idx" ON "Shop"("shopGroupId");

-- ── DeviceSession — new columns ──────────────────────────────

ALTER TABLE "DeviceSession" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- ── User — new columns ───────────────────────────────────────

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- ── Product — new columns ────────────────────────────────────

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "itemCode"       TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "warrantyPeriod" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isWeighted"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "pluCode"        TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isService"      BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Product_shopId_itemCode_key" ON "Product"("shopId", "itemCode");

-- ── Customer — new columns ───────────────────────────────────

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- ── Sale — new columns ───────────────────────────────────────

ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "cardFee"     DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "cardFeeRate" DECIMAL(5,4)  NOT NULL DEFAULT 0;

-- ── SaleItem — new columns ───────────────────────────────────

ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "variantLabel" TEXT;

-- ── PasswordResetToken ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "otp"       TEXT         NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used"      BOOLEAN      NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

DO $$ BEGIN
  ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ProductVariant ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ProductVariant" (
    "id"         TEXT          NOT NULL,
    "productId"  TEXT          NOT NULL,
    "size"       TEXT          NOT NULL,
    "color"      TEXT,
    "sku"        TEXT,
    "stockQty"   DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lowStockAt" DECIMAL(10,2) NOT NULL DEFAULT 3,
    "sellPrice"  DECIMAL(10,2),
    "isActive"   BOOLEAN       NOT NULL DEFAULT true,
    "createdAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_productId_size_color_key"
    ON "ProductVariant"("productId", "size", "color");

CREATE INDEX IF NOT EXISTS "ProductVariant_productId_idx" ON "ProductVariant"("productId");

DO $$ BEGIN
  ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── MaintenancePayment ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS "MaintenancePayment" (
    "id"          TEXT          NOT NULL,
    "shopId"      TEXT          NOT NULL,
    "amount"      DECIMAL(10,2) NOT NULL,
    "currency"    TEXT          NOT NULL DEFAULT 'LKR',
    "method"      TEXT          NOT NULL DEFAULT 'MANUAL',
    "reference"   TEXT,
    "note"        TEXT,
    "periodStart" TIMESTAMP(3)  NOT NULL,
    "periodEnd"   TIMESTAMP(3)  NOT NULL,
    "paidAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenancePayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MaintenancePayment_shopId_idx" ON "MaintenancePayment"("shopId");

DO $$ BEGIN
  ALTER TABLE "MaintenancePayment" ADD CONSTRAINT "MaintenancePayment_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── BackupLog ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "BackupLog" (
    "id"        TEXT         NOT NULL,
    "type"      TEXT         NOT NULL,
    "status"    TEXT         NOT NULL,
    "fileId"    TEXT,
    "fileName"  TEXT,
    "fileSize"  INTEGER,
    "driveUrl"  TEXT,
    "error"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackupLog_pkey" PRIMARY KEY ("id")
);

-- ── Employee ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Employee" (
    "id"        TEXT          NOT NULL,
    "shopId"    TEXT          NOT NULL,
    "name"      TEXT          NOT NULL,
    "phone"     TEXT,
    "email"     TEXT,
    "nic"       TEXT,
    "position"  TEXT,
    "payType"   "PayType"     NOT NULL,
    "payRate"   DECIMAL(10,2) NOT NULL,
    "joinDate"  TIMESTAMP(3),
    "isActive"  BOOLEAN       NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Employee_shopId_idx" ON "Employee"("shopId");

DO $$ BEGIN
  ALTER TABLE "Employee" ADD CONSTRAINT "Employee_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── PayrollRecord ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PayrollRecord" (
    "id"              TEXT           NOT NULL,
    "shopId"          TEXT           NOT NULL,
    "employeeId"      TEXT           NOT NULL,
    "periodType"      "RecordPeriod" NOT NULL,
    "periodStart"     TIMESTAMP(3)   NOT NULL,
    "periodEnd"       TIMESTAMP(3)   NOT NULL,
    "hoursWorked"     DECIMAL(6,2),
    "grossAmount"     DECIMAL(10,2)  NOT NULL,
    "totalDeductions" DECIMAL(10,2)  NOT NULL DEFAULT 0,
    "netAmount"       DECIMAL(10,2)  NOT NULL,
    "status"          "RecordStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt"          TIMESTAMP(3),
    "note"            TEXT,
    "createdAt"       TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PayrollRecord_shopId_periodStart_idx" ON "PayrollRecord"("shopId", "periodStart");
CREATE INDEX IF NOT EXISTS "PayrollRecord_employeeId_idx"          ON "PayrollRecord"("employeeId");

DO $$ BEGIN
  ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── PayrollDeduction ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PayrollDeduction" (
    "id"              TEXT            NOT NULL,
    "payrollRecordId" TEXT            NOT NULL,
    "type"            "DeductionType" NOT NULL,
    "label"           TEXT            NOT NULL,
    "amount"          DECIMAL(10,2)   NOT NULL,
    CONSTRAINT "PayrollDeduction_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_payrollRecordId_fkey"
    FOREIGN KEY ("payrollRecordId") REFERENCES "PayrollRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
