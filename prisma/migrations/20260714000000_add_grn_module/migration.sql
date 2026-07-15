-- Add GRN (Goods Received Note) module
-- Adds: PURCHASE movement type, GRNStatus enum, GRN + GRNItem tables, grnEnabled flag on Shop

-- ── New enum values ───────────────────────────────────────────

DO $$ BEGIN CREATE TYPE "GRNStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TYPE "MovementType" ADD VALUE 'PURCHASE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Shop: grnEnabled flag ─────────────────────────────────────

ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "grnEnabled" BOOLEAN NOT NULL DEFAULT false;

-- ── GRN table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "GRN" (
    "id"           TEXT         NOT NULL,
    "shopId"       TEXT         NOT NULL,
    "supplierName" TEXT,
    "referenceNo"  TEXT,
    "note"         TEXT,
    "status"       "GRNStatus"  NOT NULL DEFAULT 'DRAFT',
    "confirmedAt"  TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GRN_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GRN_shopId_idx" ON "GRN"("shopId");

DO $$ BEGIN
  ALTER TABLE "GRN" ADD CONSTRAINT "GRN_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── GRNItem table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "GRNItem" (
    "id"           TEXT          NOT NULL,
    "grnId"        TEXT          NOT NULL,
    "productId"    TEXT,
    "newName"      TEXT,
    "newCategory"  TEXT,
    "newUnit"      TEXT,
    "newSellPrice" DECIMAL(10,2),
    "newItemCode"  TEXT,
    "quantity"     DECIMAL(10,2) NOT NULL,
    "unitCost"     DECIMAL(10,2) NOT NULL,
    "updateCost"   BOOLEAN       NOT NULL DEFAULT true,
    CONSTRAINT "GRNItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GRNItem_grnId_idx" ON "GRNItem"("grnId");

DO $$ BEGIN
  ALTER TABLE "GRNItem" ADD CONSTRAINT "GRNItem_grnId_fkey"
    FOREIGN KEY ("grnId") REFERENCES "GRN"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GRNItem" ADD CONSTRAINT "GRNItem_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
