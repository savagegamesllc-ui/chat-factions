-- CreateTable
CREATE TABLE "public"."Streamer" (
    "id" TEXT NOT NULL,
    "twitchUserId" TEXT NOT NULL,
    "login" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "overlayToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Streamer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OverlayAsset" (
    "id" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "urlPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OverlayAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Streamer_twitchUserId_key" ON "public"."Streamer"("twitchUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Streamer_overlayToken_key" ON "public"."Streamer"("overlayToken");

-- CreateIndex
CREATE INDEX "OverlayAsset_streamerId_createdAt_idx" ON "public"."OverlayAsset"("streamerId", "createdAt");

-- CreateIndex
CREATE INDEX "OverlayAsset_kind_idx" ON "public"."OverlayAsset"("kind");

-- CreateIndex
CREATE INDEX "EventLog_sessionId_createdAt_idx" ON "public"."EventLog"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."OverlayAsset" ADD CONSTRAINT "OverlayAsset_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "public"."Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
