-- CreateEnum
CREATE TYPE "StickerStatus" AS ENUM ('PENDING', 'PRINTED');

-- CreateTable
CREATE TABLE "StickerQueue" (
    "id" SERIAL NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "status" "StickerStatus" NOT NULL DEFAULT 'PENDING',
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StickerQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StickerQueue_inventoryId_key" ON "StickerQueue"("inventoryId");

-- AddForeignKey
ALTER TABLE "StickerQueue" ADD CONSTRAINT "StickerQueue_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
