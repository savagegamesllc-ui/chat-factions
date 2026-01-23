-- CreateTable
CREATE TABLE "public"."Viewer" (
    "id" TEXT NOT NULL,
    "twitchUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Viewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Faction" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FactionMembership" (
    "id" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactionMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StreamSession" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EventLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "viewerId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Viewer_twitchUserId_key" ON "public"."Viewer"("twitchUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Faction_key_key" ON "public"."Faction"("key");

-- CreateIndex
CREATE INDEX "FactionMembership_factionId_idx" ON "public"."FactionMembership"("factionId");

-- CreateIndex
CREATE UNIQUE INDEX "FactionMembership_viewerId_factionId_key" ON "public"."FactionMembership"("viewerId", "factionId");

-- CreateIndex
CREATE INDEX "EventLog_type_createdAt_idx" ON "public"."EventLog"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."FactionMembership" ADD CONSTRAINT "FactionMembership_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "public"."Viewer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FactionMembership" ADD CONSTRAINT "FactionMembership_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "public"."Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventLog" ADD CONSTRAINT "EventLog_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "public"."Viewer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventLog" ADD CONSTRAINT "EventLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."StreamSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
