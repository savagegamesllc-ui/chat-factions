-- CreateTable
CREATE TABLE "public"."VoteEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "userId" TEXT,
    "username" TEXT,
    "source" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserActionCooldown" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userKey" TEXT NOT NULL,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActionCooldown_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoteEvent_sessionId_createdAt_idx" ON "public"."VoteEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "VoteEvent_sessionId_userId_createdAt_idx" ON "public"."VoteEvent"("sessionId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "VoteEvent_sessionId_faction_createdAt_idx" ON "public"."VoteEvent"("sessionId", "faction", "createdAt");

-- CreateIndex
CREATE INDEX "UserActionCooldown_sessionId_action_lastAt_idx" ON "public"."UserActionCooldown"("sessionId", "action", "lastAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserActionCooldown_sessionId_action_userKey_key" ON "public"."UserActionCooldown"("sessionId", "action", "userKey");
