-- Add variant fields for inline new-product creation in GRN

ALTER TABLE "GRNItem" ADD COLUMN IF NOT EXISTS "newVariantSize"  TEXT;
ALTER TABLE "GRNItem" ADD COLUMN IF NOT EXISTS "newVariantColor" TEXT;
