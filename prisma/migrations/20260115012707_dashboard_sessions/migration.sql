-- CreateTable
CREATE TABLE "public"."DashboardSession" (
    "sid" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardSession_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE INDEX "DashboardSession_expiresAt_idx" ON "public"."DashboardSession"("expiresAt");
