-- AlterTable
ALTER TABLE "transport"."Incident" ADD COLUMN     "code" TEXT;

-- Backfill: number existing incidents per school in the order they happened,
-- starting at INC-1001.
UPDATE "transport"."Incident" AS i
SET "code" = 'INC-' || (1000 + n.rn)
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "schoolId" ORDER BY "occurredAt", "id") AS rn
  FROM "transport"."Incident"
) AS n
WHERE n."id" = i."id";

-- CreateIndex
CREATE UNIQUE INDEX "Incident_schoolId_code_key" ON "transport"."Incident"("schoolId", "code");
