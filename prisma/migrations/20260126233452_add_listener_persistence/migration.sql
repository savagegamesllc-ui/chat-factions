-- prisma/migrations/20260126233452_add_listener_persistence/migration.sql

-- AlterTable
ALTER TABLE "Streamer"
ADD COLUMN "listenerDesired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "listenerLastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN "listenerStartedAt" TIMESTAMP(3);
