/*
  Warnings:

  - A unique constraint covering the columns `[streamerId,selectedSlot]` on the table `StreamerLayout` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."StreamerLayout_isSelected_idx";

-- AlterTable
ALTER TABLE "public"."StreamerLayout" ADD COLUMN     "selectedSlot" INTEGER;

-- CreateIndex
CREATE INDEX "StreamerLayout_streamerId_selectedSlot_idx" ON "public"."StreamerLayout"("streamerId", "selectedSlot");

-- CreateIndex
CREATE UNIQUE INDEX "StreamerLayout_streamerId_selectedSlot_key" ON "public"."StreamerLayout"("streamerId", "selectedSlot");
