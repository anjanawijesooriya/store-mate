-- AlterEnum
ALTER TYPE "SaleStatus" ADD VALUE 'EXCHANGED';

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "originalSaleId" TEXT;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "returned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Sale_originalSaleId_idx" ON "Sale"("originalSaleId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_originalSaleId_fkey" FOREIGN KEY ("originalSaleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
