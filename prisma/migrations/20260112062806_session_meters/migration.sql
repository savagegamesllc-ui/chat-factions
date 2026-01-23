-- CreateTable
CREATE TABLE "public"."SessionFactionMeter" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,
    "meter" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionFactionMeter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionFactionMeter_sessionId_idx" ON "public"."SessionFactionMeter"("sessionId");

-- CreateIndex
CREATE INDEX "SessionFactionMeter_factionId_idx" ON "public"."SessionFactionMeter"("factionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionFactionMeter_sessionId_factionId_key" ON "public"."SessionFactionMeter"("sessionId", "factionId");

-- AddForeignKey
ALTER TABLE "public"."SessionFactionMeter" ADD CONSTRAINT "SessionFactionMeter_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."StreamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionFactionMeter" ADD CONSTRAINT "SessionFactionMeter_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "public"."Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
