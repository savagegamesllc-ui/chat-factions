-- CreateTable
CREATE TABLE "public"."CompanionApiKey" (
    "id" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CompanionApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanionApiKey_streamerId_key" ON "public"."CompanionApiKey"("streamerId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanionApiKey_keyHash_key" ON "public"."CompanionApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "CompanionApiKey_keyHash_idx" ON "public"."CompanionApiKey"("keyHash");

-- AddForeignKey
ALTER TABLE "public"."CompanionApiKey" ADD CONSTRAINT "CompanionApiKey_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "public"."Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
