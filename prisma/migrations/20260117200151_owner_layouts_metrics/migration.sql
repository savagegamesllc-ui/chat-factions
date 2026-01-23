-- AlterTable
ALTER TABLE "public"."Streamer" ADD COLUMN     "planTier" "public"."PlanTier" NOT NULL DEFAULT 'FREE';

-- CreateTable
CREATE TABLE "public"."OverlayLayout" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "styleKey" TEXT NOT NULL,
    "config" JSONB,
    "tier" "public"."PlanTier" NOT NULL DEFAULT 'FREE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OverlayLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StreamerLayout" (
    "id" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "overrideConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamerLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OverlayView" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "streamerId" TEXT,
    "layoutId" TEXT,
    "styleKey" TEXT,
    "path" TEXT,
    "userAgent" TEXT,
    "ipHash" TEXT,

    CONSTRAINT "OverlayView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OverlayLayout_styleKey_idx" ON "public"."OverlayLayout"("styleKey");

-- CreateIndex
CREATE INDEX "OverlayLayout_tier_isActive_idx" ON "public"."OverlayLayout"("tier", "isActive");

-- CreateIndex
CREATE INDEX "StreamerLayout_streamerId_isSelected_idx" ON "public"."StreamerLayout"("streamerId", "isSelected");

-- CreateIndex
CREATE INDEX "StreamerLayout_layoutId_idx" ON "public"."StreamerLayout"("layoutId");

-- CreateIndex
CREATE UNIQUE INDEX "StreamerLayout_streamerId_layoutId_key" ON "public"."StreamerLayout"("streamerId", "layoutId");

-- CreateIndex
CREATE INDEX "OverlayView_createdAt_idx" ON "public"."OverlayView"("createdAt");

-- CreateIndex
CREATE INDEX "OverlayView_layoutId_createdAt_idx" ON "public"."OverlayView"("layoutId", "createdAt");

-- CreateIndex
CREATE INDEX "OverlayView_streamerId_createdAt_idx" ON "public"."OverlayView"("streamerId", "createdAt");

-- CreateIndex
CREATE INDEX "AppErrorLog_level_createdAt_idx" ON "public"."AppErrorLog"("level", "createdAt");

-- CreateIndex
CREATE INDEX "AppErrorLog_createdAt_idx" ON "public"."AppErrorLog"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."StreamerLayout" ADD CONSTRAINT "StreamerLayout_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "public"."Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StreamerLayout" ADD CONSTRAINT "StreamerLayout_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "public"."OverlayLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OverlayView" ADD CONSTRAINT "OverlayView_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "public"."Streamer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OverlayView" ADD CONSTRAINT "OverlayView_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "public"."OverlayLayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
