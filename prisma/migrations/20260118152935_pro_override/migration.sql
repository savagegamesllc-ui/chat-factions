/*
  Warnings:

  - You are about to drop the column `path` on the `OverlayView` table. All the data in the column will be lost.
  - You are about to drop the column `styleKey` on the `OverlayView` table. All the data in the column will be lost.
  - Made the column `streamerId` on table `OverlayView` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."OverlayView" DROP CONSTRAINT "OverlayView_streamerId_fkey";

-- DropIndex
DROP INDEX "public"."AppErrorLog_createdAt_idx";

-- DropIndex
DROP INDEX "public"."OverlayLayout_tier_isActive_idx";

-- DropIndex
DROP INDEX "public"."OverlayView_createdAt_idx";

-- DropIndex
DROP INDEX "public"."StreamerLayout_streamerId_isSelected_idx";

-- AlterTable
ALTER TABLE "public"."OverlayView" DROP COLUMN "path",
DROP COLUMN "styleKey",
ALTER COLUMN "streamerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Streamer" ADD COLUMN     "proGrantedAt" TIMESTAMP(3),
ADD COLUMN     "proOverride" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "StreamerLayout_streamerId_idx" ON "public"."StreamerLayout"("streamerId");

-- AddForeignKey
ALTER TABLE "public"."OverlayView" ADD CONSTRAINT "OverlayView_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "public"."Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
