-- CreateIndex
CREATE INDEX "GRNItem_productId_idx" ON "GRNItem"("productId");

-- CreateIndex
CREATE INDEX "PayrollDeduction_payrollRecordId_idx" ON "PayrollDeduction"("payrollRecordId");

-- CreateIndex
CREATE INDEX "Sale_shopId_status_createdAt_idx" ON "Sale"("shopId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "User_shopId_idx" ON "User"("shopId");

-- CreateIndex
CREATE INDEX "User_shopId_role_idx" ON "User"("shopId", "role");
