-- AlterTable
ALTER TABLE "public"."OverlayView" ADD COLUMN     "path" TEXT,
ADD COLUMN     "styleKey" TEXT;

-- CreateIndex
CREATE INDEX "OverlayView_styleKey_createdAt_idx" ON "public"."OverlayView"("styleKey", "createdAt");
