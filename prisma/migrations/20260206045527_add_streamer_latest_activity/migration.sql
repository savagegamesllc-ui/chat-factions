-- CreateTable
CREATE TABLE "public"."StreamerLatestActivity" (
    "streamerId" TEXT NOT NULL,
    "latestFollowerName" TEXT,
    "latestFollowerAt" TIMESTAMP(3),
    "latestSubscriberName" TEXT,
    "latestSubscriberAt" TIMESTAMP(3),
    "latestSubscriberTier" TEXT,
    "latestSubscriberIsGift" BOOLEAN,
    "latestCheerName" TEXT,
    "latestCheerAt" TIMESTAMP(3),
    "latestCheerBits" INTEGER,
    "latestTipName" TEXT,
    "latestTipAt" TIMESTAMP(3),
    "latestTipAmount" DOUBLE PRECISION,
    "latestTipCurrency" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamerLatestActivity_pkey" PRIMARY KEY ("streamerId")
);

-- AddForeignKey
ALTER TABLE "public"."StreamerLatestActivity" ADD CONSTRAINT "StreamerLatestActivity_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "public"."Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
