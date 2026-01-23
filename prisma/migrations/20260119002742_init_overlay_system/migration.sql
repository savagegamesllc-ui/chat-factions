/*
  Warnings:

  - You are about to drop the column `config` on the `OverlayLayout` table. All the data in the column will be lost.
  - You are about to drop the column `overlayStyle` on the `Streamer` table. All the data in the column will be lost.
  - You are about to drop the column `overlayStyleConfig` on the `Streamer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[streamerId,key]` on the table `Faction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[streamerId,twitchUserId]` on the table `Viewer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `streamerId` to the `EventLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `streamerId` to the `Faction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `streamerId` to the `FactionMembership` table without a default value. This is not possible if the table is not empty.
  - Added the required column `streamerId` to the `StreamSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `streamerId` to the `Viewer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `streamerId` to the `VoteEvent` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."EventLog_type_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Faction_key_key";

-- DropIndex
DROP INDEX "public"."Viewer_twitchUserId_key";

-- AlterTable
ALTER TABLE "public"."EventLog" ADD COLUMN     "streamerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Faction" ADD COLUMN     "streamerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."FactionMembership" ADD COLUMN     "streamerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."OverlayLayout" DROP COLUMN "config",
ADD COLUMN     "defaultConfig" JSONB,
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "public"."StreamSession" ADD COLUMN     "streamerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Streamer" DROP COLUMN "overlayStyle",
DROP COLUMN "overlayStyleConfig";

-- AlterTable
ALTER TABLE "public"."Viewer" ADD COLUMN     "streamerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."VoteEvent" ADD COLUMN     "streamerId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "EventLog_streamerId_type_createdAt_idx" ON "public"."EventLog"("streamerId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Faction_streamerId_idx" ON "public"."Faction"("streamerId");

-- CreateIndex
CREATE UNIQUE INDEX "Faction_streamerId_key_key" ON "public"."Faction"("streamerId", "key");

-- CreateIndex
CREATE INDEX "FactionMembership_streamerId_idx" ON "public"."FactionMembership"("streamerId");

-- CreateIndex
CREATE INDEX "OverlayLayout_tier_isActive_idx" ON "public"."OverlayLayout"("tier", "isActive");

-- CreateIndex
CREATE INDEX "StreamSession_streamerId_startedAt_idx" ON "public"."StreamSession"("streamerId", "startedAt");

-- CreateIndex
CREATE INDEX "StreamerLayout_isSelected_idx" ON "public"."StreamerLayout"("isSelected");

-- CreateIndex
CREATE INDEX "Viewer_streamerId_idx" ON "public"."Viewer"("streamerId");

-- CreateIndex
CREATE UNIQUE INDEX "Viewer_streamerId_twitchUserId_key" ON "public"."Viewer"("streamerId", "twitchUserId");

-- CreateIndex
CREATE INDEX "VoteEvent_streamerId_createdAt_idx" ON "public"."VoteEvent"("streamerId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Viewer" ADD CONSTRAINT "Viewer_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "public"."Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Faction" ADD CONSTRAINT "Faction_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "public"."Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FactionMembership" ADD CONSTRAINT "FactionMembership_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "public"."Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StreamSession" ADD CONSTRAINT "StreamSession_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "public"."Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventLog" ADD CONSTRAINT "EventLog_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "public"."Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VoteEvent" ADD CONSTRAINT "VoteEvent_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "public"."Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
