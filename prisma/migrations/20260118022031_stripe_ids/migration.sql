/*
  Warnings:

  - A unique constraint covering the columns `[stripeCustomerId]` on the table `Streamer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeSubscriptionId]` on the table `Streamer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Streamer" ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Streamer_stripeCustomerId_key" ON "public"."Streamer"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Streamer_stripeSubscriptionId_key" ON "public"."Streamer"("stripeSubscriptionId");
