-- Add an unguessable per-sale receipt token so public receipt links
-- (/r/<token>) can no longer be enumerated via the sequential-ish cuid id.
ALTER TABLE "Sale" ADD COLUMN "receiptToken" TEXT;

-- Backfill every existing sale with a random token so old rows are shareable
-- under the new scheme. gen_random_uuid() is built into Postgres 13+.
UPDATE "Sale" SET "receiptToken" = gen_random_uuid()::text WHERE "receiptToken" IS NULL;

-- Enforce uniqueness (also creates the lookup index used by the receipt route).
CREATE UNIQUE INDEX "Sale_receiptToken_key" ON "Sale"("receiptToken");
