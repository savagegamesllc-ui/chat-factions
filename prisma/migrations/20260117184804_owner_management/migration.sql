/*
  Warnings:

  - Added the required column `updatedAt` to the `OverlayAsset` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."PlanTier" AS ENUM ('FREE', 'PRO');

-- AlterTable
ALTER TABLE "public"."OverlayAsset" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tier" "public"."PlanTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "public"."AppErrorLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL DEFAULT 'error',
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "meta" JSONB,

    CONSTRAINT "AppErrorLog_pkey" PRIMARY KEY ("id")
);
