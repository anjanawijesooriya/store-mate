-- Add variantId to SaleItem so void/refund and exchange can restore stock
-- to the correct table (ProductVariant vs Product)
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "variantId" TEXT;

DO $$ BEGIN
  ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
