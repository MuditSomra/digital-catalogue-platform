-- AlterTable
ALTER TABLE "categories" ADD COLUMN "skuPrefix" TEXT,
ADD COLUMN "skuLastNumber" INTEGER DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "categories_skuPrefix_key" ON "categories"("skuPrefix");

-- CreateIndex
CREATE INDEX "categories_skuPrefix_idx" ON "categories"("skuPrefix");
