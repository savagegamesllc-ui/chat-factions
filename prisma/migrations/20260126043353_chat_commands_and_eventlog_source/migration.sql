-- CreateEnum
CREATE TYPE "public"."ChatCommandType" AS ENUM ('HYPE', 'MAXHYPE', 'VOTE', 'CUSTOM');

-- AlterTable
ALTER TABLE "public"."EventLog" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'system';

-- CreateTable
CREATE TABLE "public"."ChatCommand" (
    "id" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "type" "public"."ChatCommandType" NOT NULL DEFAULT 'HYPE',
    "trigger" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownSec" INTEGER NOT NULL DEFAULT 30,
    "bypassBroadcaster" BOOLEAN NOT NULL DEFAULT true,
    "bypassMods" BOOLEAN NOT NULL DEFAULT true,
    "maxDelta" INTEGER,
    "defaultDelta" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatCommandAlias" (
    "id" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatCommandAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatCommand_streamerId_idx" ON "public"."ChatCommand"("streamerId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatCommand_streamerId_trigger_key" ON "public"."ChatCommand"("streamerId", "trigger");

-- CreateIndex
CREATE INDEX "ChatCommandAlias_alias_idx" ON "public"."ChatCommandAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "ChatCommandAlias_commandId_alias_key" ON "public"."ChatCommandAlias"("commandId", "alias");

-- AddForeignKey
ALTER TABLE "public"."ChatCommand" ADD CONSTRAINT "ChatCommand_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "public"."Streamer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatCommandAlias" ADD CONSTRAINT "ChatCommandAlias_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "public"."ChatCommand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
