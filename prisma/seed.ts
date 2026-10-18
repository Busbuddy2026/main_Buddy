/**
 * Seed a real database: one school and its two admin sign-ins, nothing else.
 * Buses, crew, routes, stops and students are added through the admin portal;
 * the tracker comes from the school's LivePin account (Settings → Tracking
 * provider, then the bus form).
 *
 * The admin password comes from SEED_ADMIN_PASSWORD, or a random one is
 * generated and printed once. Change it after the first sign-in.
 *
 * Demo data lives in prisma/seed-demo.ts and goes to the test database only.
 * Refuses to run when the school already exists.
 */

import { randomBytes } from "node:crypto";
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

async function main() {
  if (await db.school.findFirst({ where: { name: SCHOOL } })) {
    say(`Already seeded: ${SCHOOL} exists.`);
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
  const passwordHash = await hashSecret(password);

  const school = await db.school.create({
    data: { name: SCHOOL, timezone: "Asia/Kolkata", settings: DEFAULT_SETTINGS },
  });
  await db.adminUser.createMany({
    data: [
      { schoolId: school.id, email: "transport@bvm.edu.in", name: "Transport Manager", role: "TRANSPORT_MANAGER", passwordHash },
      { schoolId: school.id, email: "principal@bvm.edu.in", name: "Principal", role: "SUPER_ADMIN", passwordHash },
    ],
  });

  say(`Seeded ${SCHOOL} with two admin sign-ins: transport@bvm.edu.in, principal@bvm.edu.in.`);
  if (!process.env.SEED_ADMIN_PASSWORD) say(`Password (shown once, change it after signing in): ${password}`);
}

main()
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
