-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "transport";

-- CreateEnum
CREATE TYPE "transport"."AdminRole" AS ENUM ('SUPER_ADMIN', 'TRANSPORT_MANAGER', 'OFFICE_STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "transport"."BusStatus" AS ENUM ('ACTIVE', 'IDLE', 'OFFLINE', 'DELAYED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "transport"."RouteStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "transport"."TripPhase" AS ENUM ('MORNING', 'EVENING');

-- CreateEnum
CREATE TYPE "transport"."TripStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'DELAYED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "transport"."MarkPhase" AS ENUM ('BOARD', 'DROP');

-- CreateEnum
CREATE TYPE "transport"."MarkStatus" AS ENUM ('BOARDED', 'DROPPED', 'ABSENT');

-- CreateEnum
CREATE TYPE "transport"."CrewRole" AS ENUM ('DRIVER', 'ATTENDANT');

-- CreateEnum
CREATE TYPE "transport"."CrewStatus" AS ENUM ('ON_DUTY', 'IDLE', 'OFF_DUTY', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "transport"."CameraStatus" AS ENUM ('ONLINE', 'OFFLINE', 'RECORDING_ISSUE');

-- CreateEnum
CREATE TYPE "transport"."IncidentStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'INVESTIGATING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "transport"."Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "transport"."DocOwner" AS ENUM ('BUS', 'DRIVER', 'ATTENDANT', 'STUDENT');

-- CreateEnum
CREATE TYPE "transport"."SchoolTripStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ON_THE_WAY', 'AT_VENUE', 'RETURNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "transport"."AppKind" AS ENUM ('ADMIN', 'PARENT', 'CREW');

-- CreateEnum
CREATE TYPE "transport"."NotificationAudience" AS ENUM ('GUARDIAN', 'ADMIN');

-- CreateTable
CREATE TABLE "transport"."School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."AdminUser" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "transport"."AdminRole" NOT NULL DEFAULT 'OFFICE_STAFF',
    "totpSecret" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."PasswordReset" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."Guardian" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "prefs" JSONB NOT NULL DEFAULT '{"alerts":true,"absence":true,"digest":false}',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."Crew" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "role" "transport"."CrewRole" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "pinSetAt" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "boundDeviceId" TEXT,
    "licenceNo" TEXT,
    "licenceExpiry" TIMESTAMP(3),
    "safetyScore" INTEGER DEFAULT 100,
    "status" "transport"."CrewStatus" NOT NULL DEFAULT 'IDLE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Crew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."Bus" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "make" TEXT,
    "year" INTEGER,
    "status" "transport"."BusStatus" NOT NULL DEFAULT 'IDLE',
    "driverId" TEXT,
    "attendantId" TEXT,
    "routeId" TEXT,
    "gpsDeviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Bus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."GpsDevice" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "busId" TEXT,
    "lastPingAt" TIMESTAMP(3),

    CONSTRAINT "GpsDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."Route" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "zone" TEXT,
    "distanceM" INTEGER,
    "durationS" INTEGER,
    "geometry" JSONB,
    "status" "transport"."RouteStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."Stop" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "landmark" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Stop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "pickupTime" TEXT NOT NULL,
    "dropTime" TEXT NOT NULL,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."Student" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "roll" TEXT,
    "busId" TEXT,
    "routeId" TEXT,
    "stopId" TEXT,
    "photoUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."StudentGuardian" (
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "relation" TEXT,
    "primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("studentId","guardianId")
);

-- CreateTable
CREATE TABLE "transport"."Trip" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "phase" "transport"."TripPhase" NOT NULL,
    "busId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "driverId" TEXT,
    "attendantId" TEXT,
    "status" "transport"."TripStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "delayMin" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."AttendanceMark" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "phase" "transport"."MarkPhase" NOT NULL,
    "status" "transport"."MarkStatus" NOT NULL,
    "stopId" TEXT,
    "clientMarkId" TEXT NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedById" TEXT NOT NULL,
    "undone" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AttendanceMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."AbsenceRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "phase" TEXT NOT NULL,
    "reason" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbsenceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."LocationPing" (
    "id" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "tripId" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speedKph" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationPing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."Camera" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "streamKey" TEXT NOT NULL,
    "firmware" TEXT,
    "status" "transport"."CameraStatus" NOT NULL DEFAULT 'ONLINE',
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "Camera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."Recording" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationS" INTEGER NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "backedUpAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."Incident" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "busId" TEXT,
    "tripId" TEXT,
    "type" TEXT NOT NULL,
    "severity" "transport"."Severity" NOT NULL DEFAULT 'MEDIUM',
    "status" "transport"."IncidentStatus" NOT NULL DEFAULT 'NEW',
    "description" TEXT NOT NULL,
    "assignedTo" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "clipIds" TEXT[],

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."IncidentEvent" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."SchoolTrip" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "departTime" TEXT NOT NULL,
    "returnTime" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "notes" TEXT,
    "status" "transport"."SchoolTripStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SchoolTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."SchoolTripFleet" (
    "id" TEXT NOT NULL,
    "schoolTripId" TEXT NOT NULL,
    "busId" TEXT NOT NULL,
    "driverId" TEXT,
    "attendantId" TEXT,
    "studentCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SchoolTripFleet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."SchoolTripStudent" (
    "schoolTripId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fleetId" TEXT,
    "consentAt" TIMESTAMP(3),

    CONSTRAINT "SchoolTripStudent_pkey" PRIMARY KEY ("schoolTripId","studentId")
);

-- CreateTable
CREATE TABLE "transport"."Document" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "ownerType" "transport"."DocOwner" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "issuedOn" TIMESTAMP(3),
    "expiresOn" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."Device" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT,
    "crewId" TEXT,
    "fcmToken" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."Notification" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "audience" "transport"."NotificationAudience" NOT NULL DEFAULT 'GUARDIAN',
    "guardianId" TEXT,
    "studentId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."AuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "app" "transport"."AppKind" NOT NULL,
    "actorId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport"."IdempotencyKey" (
    "key" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("schoolId","key")
);

-- CreateTable
CREATE TABLE "transport"."RateLimitHit" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminUser_email_idx" ON "transport"."AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_schoolId_email_key" ON "transport"."AdminUser"("schoolId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "transport"."PasswordReset"("tokenHash");

-- CreateIndex
CREATE INDEX "Guardian_phone_idx" ON "transport"."Guardian"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_schoolId_phone_key" ON "transport"."Guardian"("schoolId", "phone");

-- CreateIndex
CREATE INDEX "OtpCode_phone_createdAt_idx" ON "transport"."OtpCode"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "Crew_crewId_idx" ON "transport"."Crew"("crewId");

-- CreateIndex
CREATE UNIQUE INDEX "Crew_schoolId_crewId_key" ON "transport"."Crew"("schoolId", "crewId");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_gpsDeviceId_key" ON "transport"."Bus"("gpsDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Bus_schoolId_number_key" ON "transport"."Bus"("schoolId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "GpsDevice_imei_key" ON "transport"."GpsDevice"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "GpsDevice_busId_key" ON "transport"."GpsDevice"("busId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_routeId_sequence_key" ON "transport"."RouteStop"("routeId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_routeId_stopId_key" ON "transport"."RouteStop"("routeId", "stopId");

-- CreateIndex
CREATE INDEX "Student_schoolId_busId_idx" ON "transport"."Student"("schoolId", "busId");

-- CreateIndex
CREATE INDEX "Trip_schoolId_date_idx" ON "transport"."Trip"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_busId_date_phase_key" ON "transport"."Trip"("busId", "date", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceMark_clientMarkId_key" ON "transport"."AttendanceMark"("clientMarkId");

-- CreateIndex
CREATE INDEX "AttendanceMark_studentId_markedAt_idx" ON "transport"."AttendanceMark"("studentId", "markedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceMark_tripId_studentId_phase_key" ON "transport"."AttendanceMark"("tripId", "studentId", "phase");

-- CreateIndex
CREATE INDEX "AbsenceRequest_schoolId_date_idx" ON "transport"."AbsenceRequest"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceRequest_studentId_date_phase_key" ON "transport"."AbsenceRequest"("studentId", "date", "phase");

-- CreateIndex
CREATE INDEX "LocationPing_busId_recordedAt_idx" ON "transport"."LocationPing"("busId", "recordedAt");

-- CreateIndex
CREATE INDEX "Recording_busId_startedAt_idx" ON "transport"."Recording"("busId", "startedAt");

-- CreateIndex
CREATE INDEX "Incident_schoolId_occurredAt_idx" ON "transport"."Incident"("schoolId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolTripFleet_schoolTripId_busId_key" ON "transport"."SchoolTripFleet"("schoolTripId", "busId");

-- CreateIndex
CREATE INDEX "Document_ownerType_ownerId_idx" ON "transport"."Document"("ownerType", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_fcmToken_key" ON "transport"."Device"("fcmToken");

-- CreateIndex
CREATE INDEX "Notification_guardianId_sentAt_idx" ON "transport"."Notification"("guardianId", "sentAt");

-- CreateIndex
CREATE INDEX "Notification_schoolId_audience_sentAt_idx" ON "transport"."Notification"("schoolId", "audience", "sentAt");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "transport"."AuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "transport"."AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "transport"."Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_actorId_idx" ON "transport"."Session"("actorId");

-- CreateIndex
CREATE INDEX "RateLimitHit_bucket_createdAt_idx" ON "transport"."RateLimitHit"("bucket", "createdAt");

-- AddForeignKey
ALTER TABLE "transport"."Bus" ADD CONSTRAINT "Bus_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "transport"."Crew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."Bus" ADD CONSTRAINT "Bus_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "transport"."Crew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."Bus" ADD CONSTRAINT "Bus_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport"."Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport"."Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."RouteStop" ADD CONSTRAINT "RouteStop_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "transport"."Stop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."Student" ADD CONSTRAINT "Student_busId_fkey" FOREIGN KEY ("busId") REFERENCES "transport"."Bus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."Student" ADD CONSTRAINT "Student_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport"."Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."Student" ADD CONSTRAINT "Student_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "transport"."Stop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "transport"."Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "transport"."Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."Trip" ADD CONSTRAINT "Trip_busId_fkey" FOREIGN KEY ("busId") REFERENCES "transport"."Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."Trip" ADD CONSTRAINT "Trip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "transport"."Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."AttendanceMark" ADD CONSTRAINT "AttendanceMark_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "transport"."Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."AttendanceMark" ADD CONSTRAINT "AttendanceMark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "transport"."Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."Camera" ADD CONSTRAINT "Camera_busId_fkey" FOREIGN KEY ("busId") REFERENCES "transport"."Bus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."IncidentEvent" ADD CONSTRAINT "IncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "transport"."Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."SchoolTripFleet" ADD CONSTRAINT "SchoolTripFleet_schoolTripId_fkey" FOREIGN KEY ("schoolTripId") REFERENCES "transport"."SchoolTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."SchoolTripStudent" ADD CONSTRAINT "SchoolTripStudent_schoolTripId_fkey" FOREIGN KEY ("schoolTripId") REFERENCES "transport"."SchoolTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport"."Device" ADD CONSTRAINT "Device_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "transport"."Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;
