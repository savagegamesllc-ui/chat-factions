/*
  Warnings:

  - A unique constraint covering the columns `[eventApiKey]` on the table `Streamer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Streamer" ADD COLUMN     "eventApiKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Streamer_eventApiKey_key" ON "public"."Streamer"("eventApiKey");
