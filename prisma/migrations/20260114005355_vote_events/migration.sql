/*
  Warnings:

  - You are about to drop the column `faction` on the `VoteEvent` table. All the data in the column will be lost.
  - You are about to drop the column `meterId` on the `VoteEvent` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `VoteEvent` table. All the data in the column will be lost.
  - You are about to drop the `UserActionCooldown` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `factionId` to the `VoteEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `factionKey` to the `VoteEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userKey` to the `VoteEvent` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."VoteEvent_sessionId_faction_createdAt_idx";

-- DropIndex
DROP INDEX "public"."VoteEvent_sessionId_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "public"."VoteEvent" DROP COLUMN "faction",
DROP COLUMN "meterId",
DROP COLUMN "userId",
ADD COLUMN     "factionId" TEXT NOT NULL,
ADD COLUMN     "factionKey" TEXT NOT NULL,
ADD COLUMN     "userKey" TEXT NOT NULL,
ALTER COLUMN "source" SET DEFAULT 'chat';

-- DropTable
DROP TABLE "public"."UserActionCooldown";

-- CreateTable
CREATE TABLE "public"."VoteCooldown" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userKey" TEXT NOT NULL,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoteCooldown_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoteCooldown_sessionId_action_lastAt_idx" ON "public"."VoteCooldown"("sessionId", "action", "lastAt");

-- CreateIndex
CREATE UNIQUE INDEX "VoteCooldown_sessionId_action_userKey_key" ON "public"."VoteCooldown"("sessionId", "action", "userKey");

-- CreateIndex
CREATE INDEX "VoteEvent_sessionId_userKey_createdAt_idx" ON "public"."VoteEvent"("sessionId", "userKey", "createdAt");

-- CreateIndex
CREATE INDEX "VoteEvent_sessionId_factionKey_createdAt_idx" ON "public"."VoteEvent"("sessionId", "factionKey", "createdAt");
