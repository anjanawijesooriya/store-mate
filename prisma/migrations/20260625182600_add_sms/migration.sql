-- CreateEnum
CREATE TYPE "SmsType" AS ENUM ('LOW_STOCK', 'DAILY_SUMMARY', 'RECEIPT', 'OTP');

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "smsDailySummary" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "smsLowStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "smsMonthlyUsage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "smsReceiptEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "type" "SmsType" NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsLog_shopId_createdAt_idx" ON "SmsLog"("shopId", "createdAt");

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
