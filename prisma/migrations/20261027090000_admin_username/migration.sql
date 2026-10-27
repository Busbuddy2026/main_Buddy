-- Admins sign in with a username instead of an email.
ALTER TABLE "transport"."AdminUser" ADD COLUMN "username" TEXT;

-- Existing accounts take the part of their email before the @, with a
-- number added when two accounts would share it.
UPDATE "transport"."AdminUser" AS a
SET "username" = n.base || CASE WHEN n.rank = 1 THEN '' ELSE n.rank::text END
FROM (
  SELECT "id",
         lower(split_part("email", '@', 1)) AS base,
         row_number() OVER (PARTITION BY lower(split_part("email", '@', 1)) ORDER BY "createdAt", "id") AS rank
  FROM "transport"."AdminUser"
) AS n
WHERE a."id" = n."id";

ALTER TABLE "transport"."AdminUser" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "transport"."AdminUser" ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "transport"."AdminUser"("username");
