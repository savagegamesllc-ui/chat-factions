-- AlterTable
ALTER TABLE "public"."Streamer" ADD COLUMN     "twitchAccessToken" TEXT,
ADD COLUMN     "twitchRefreshToken" TEXT,
ADD COLUMN     "twitchScopes" JSONB,
ADD COLUMN     "twitchTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "twitchTokenUpdatedAt" TIMESTAMP(3);
