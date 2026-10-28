-- Bus cost settings for fuel estimates and service reminders.
ALTER TABLE "transport"."Bus" ADD COLUMN "mileageKmpl" DOUBLE PRECISION NOT NULL DEFAULT 5;
ALTER TABLE "transport"."Bus" ADD COLUMN "idleLph" DOUBLE PRECISION NOT NULL DEFAULT 2.5;
ALTER TABLE "transport"."Bus" ADD COLUMN "serviceEveryKm" INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE "transport"."Bus" ADD COLUMN "lastServiceOn" DATE;

-- One bus's day, from the tracker.
CREATE TABLE "transport"."BusDay" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "driverId" TEXT,
    "distanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "movingS" INTEGER NOT NULL DEFAULT 0,
    "engineOnS" INTEGER NOT NULL DEFAULT 0,
    "idleS" INTEGER NOT NULL DEFAULT 0,
    "parkedS" INTEGER NOT NULL DEFAULT 0,
    "maxSpeed" INTEGER NOT NULL DEFAULT 0,
    "avgSpeed" INTEGER NOT NULL DEFAULT 0,
    "overspeedKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overspeedCount" INTEGER NOT NULL DEFAULT 0,
    "estFuelL" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estCostRs" INTEGER NOT NULL DEFAULT 0,
    "idleCostRs" INTEGER NOT NULL DEFAULT 0,
    "schoolArrivalAt" TIMESTAMP(3),
    "idleEvents" JSONB NOT NULL DEFAULT '[]',
    "overspeedPoints" JSONB NOT NULL DEFAULT '[]',
    "afterHours" JSONB NOT NULL DEFAULT '[]',
    "offRoute" JSONB NOT NULL DEFAULT '[]',
    "stopVisits" JSONB NOT NULL DEFAULT '[]',
    "trips" JSONB NOT NULL DEFAULT '[]',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusDay_busId_date_key" ON "transport"."BusDay"("busId", "date");
CREATE INDEX "BusDay_schoolId_date_idx" ON "transport"."BusDay"("schoolId", "date");
CREATE INDEX "BusDay_driverId_date_idx" ON "transport"."BusDay"("driverId", "date");
