-- CreateTable
CREATE TABLE "public"."ExternalEventReceipt" (
    "id" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalEventReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalEventReceipt_streamerId_createdAt_idx" ON "public"."ExternalEventReceipt"("streamerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalEventReceipt_streamerId_eventId_key" ON "public"."ExternalEventReceipt"("streamerId", "eventId");

-- AddForeignKey
ALTER TABLE "public"."ExternalEventReceipt" ADD CONSTRAINT "ExternalEventReceipt_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "public"."Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
