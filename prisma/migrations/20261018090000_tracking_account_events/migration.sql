-- AlterTable
ALTER TABLE "transport"."GpsDevice" ADD COLUMN     "alertsCursor" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "transport"."TrackingAccount" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'LIVEPIN',
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.livepin.in',
    "apiKey" TEXT NOT NULL,
    "apiSecretEnc" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."TrackerEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "at" TIMESTAMP(3) NOT NULL,
    "incidentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackingAccount_schoolId_provider_key" ON "transport"."TrackingAccount"("schoolId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "TrackerEvent_externalId_key" ON "transport"."TrackerEvent"("externalId");

-- CreateIndex
CREATE INDEX "TrackerEvent_schoolId_busId_at_idx" ON "transport"."TrackerEvent"("schoolId", "busId", "at");

