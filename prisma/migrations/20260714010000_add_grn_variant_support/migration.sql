-- Add variant support to GRNItem

ALTER TABLE "GRNItem" ADD COLUMN IF NOT EXISTS "variantId"    TEXT;
ALTER TABLE "GRNItem" ADD COLUMN IF NOT EXISTS "variantLabel" TEXT;

DO $$ BEGIN
  ALTER TABLE "GRNItem"
    ADD CONSTRAINT "GRNItem_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "GRNItem_variantId_idx" ON "GRNItem"("variantId");
