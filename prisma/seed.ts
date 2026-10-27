/**
 * Seed a real database: one school and its default admin sign-in, nothing else.
 * Buses, crew, routes, stops and students are added through the admin portal;
 * the tracker comes from the school's LivePin account (Settings → Tracking
 * provider, then the bus form).
 *
 * The default admin is `admin` / `Admin@2026` (a super admin), unless
 * SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD say otherwise. Change the
 * password after the first sign-in.
 *
 * Demo data lives in prisma/seed-demo.ts and goes to the test database only.
 * When the school already exists, only adds the default admin if it is
 * missing; an existing account's password is never changed.
 */

import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashSecret } from "../src/server/auth/crypto";
import { DEFAULT_SETTINGS } from "../src/lib/api/schemas/settings";

config({ path: ".env.local", quiet: true });

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error("Set DIRECT_URL (or DATABASE_URL) in .env.local before seeding.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const say = (line: string) => process.stdout.write(`${line}\n`);

const SCHOOL = process.env.SEED_SCHOOL_NAME || "Bharath Vidya Mandir";

const USERNAME = (process.env.SEED_ADMIN_USERNAME || "admin").trim().toLowerCase();
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin@2026";

async function main() {
  const school =
    (await db.school.findFirst({ where: { name: SCHOOL } })) ??
    (await db.school.create({ data: { name: SCHOOL, timezone: "Asia/Kolkata", settings: DEFAULT_SETTINGS } }));

  if (await db.adminUser.findUnique({ where: { username: USERNAME } })) {
    say(`Already seeded: ${SCHOOL} and the ${USERNAME} sign-in exist.`);
    return;
  }
  await db.adminUser.create({
    data: {
      schoolId: school.id,
      username: USERNAME,
      name: "Administrator",
      role: "SUPER_ADMIN",
      passwordHash: await hashSecret(PASSWORD),
    },
  });

  say(`Seeded ${SCHOOL} with the default admin sign-in: ${USERNAME}.`);
  if (!process.env.SEED_ADMIN_PASSWORD) say("Password: Admin@2026. Change it after signing in.");
}

main()
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
