-- Add weighted product fields for inline new-product creation in GRN

ALTER TABLE "GRNItem" ADD COLUMN IF NOT EXISTS "newIsWeighted" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "GRNItem" ADD COLUMN IF NOT EXISTS "newPluCode"    TEXT;
