-- AlterTable
ALTER TABLE "public"."StreamSession" ADD COLUMN     "votingChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "votingOpen" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "public"."VoteEvent" ADD CONSTRAINT "VoteEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."StreamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VoteCooldown" ADD CONSTRAINT "VoteCooldown_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."StreamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
