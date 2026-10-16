-- DropIndex
DROP INDEX "transport"."LocationPing_busId_recordedAt_idx";

-- AlterTable
ALTER TABLE "transport"."GpsDevice" ADD COLUMN     "alarmState" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dashcamChannels" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "externalDeviceId" TEXT,
ADD COLUMN     "externalVehicleId" TEXT,
ADD COLUMN     "lastAddress" TEXT,
ADD COLUMN     "lastFixAt" TIMESTAMP(3),
ADD COLUMN     "lastHeading" DOUBLE PRECISION,
ADD COLUMN     "lastIgnition" BOOLEAN,
ADD COLUMN     "lastLat" DOUBLE PRECISION,
ADD COLUMN     "lastLng" DOUBLE PRECISION,
ADD COLUMN     "lastSpeed" DOUBLE PRECISION,
ADD COLUMN     "lastStatus" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'LIVEPIN',
ADD COLUMN     "vehicleNo" TEXT,
ALTER COLUMN "apiKeyHash" SET DEFAULT '';

-- AlterTable
ALTER TABLE "transport"."LocationPing" ADD COLUMN     "ignition" BOOLEAN,
ADD COLUMN     "schoolId" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "GpsDevice_schoolId_provider_externalVehicleId_key" ON "transport"."GpsDevice"("schoolId", "provider", "externalVehicleId");

-- CreateIndex
CREATE INDEX "LocationPing_schoolId_recordedAt_idx" ON "transport"."LocationPing"("schoolId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LocationPing_busId_recordedAt_key" ON "transport"."LocationPing"("busId", "recordedAt");

