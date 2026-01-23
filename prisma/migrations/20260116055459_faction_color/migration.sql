-- AlterTable
ALTER TABLE "public"."Faction" ADD COLUMN     "colorHex" TEXT NOT NULL DEFAULT '#78C8FF',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;
