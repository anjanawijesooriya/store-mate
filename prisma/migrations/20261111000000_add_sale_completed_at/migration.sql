-- Track when a sale was actually paid off, separately from when it was made.
-- For CASH/CARD/ONLINE sales this is the same instant as createdAt. For CREDIT
-- sales it stays NULL until the final installment settles the balance, so
-- revenue/profit reports can recognize the sale on the date it was paid
-- rather than the date the customer borrowed the item.
ALTER TABLE "Sale" ADD COLUMN "completedAt" TIMESTAMP(3);

-- Backfill: any sale that isn't currently awaiting payment is, by definition,
-- already resolved — use its createdAt as a best-effort completion date.
-- (We never recorded historical installment dates, so pre-existing credit
-- sales that were already settled can't be backdated to their true payoff
-- date; this only becomes exact going forward.) Sales still PENDING_PAYMENT
-- are left NULL, matching the new "not yet completed" meaning.
UPDATE "Sale" SET "completedAt" = "createdAt" WHERE status != 'PENDING_PAYMENT';

CREATE INDEX "Sale_shopId_completedAt_idx" ON "Sale"("shopId", "completedAt");
