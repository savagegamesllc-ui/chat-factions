-- AddForeignKey
ALTER TABLE "public"."VoteEvent" ADD CONSTRAINT "VoteEvent_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "public"."Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
