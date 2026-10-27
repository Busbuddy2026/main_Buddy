/**
 * Sets an admin's password from the command line, for when nobody can sign in
 * to reset it from Settings. Signs that account out everywhere, clears its
 * failed sign-in attempts and writes an audit entry.
 *
 *   npx tsx scripts/set-admin-password.ts <username> <password>                         # local
 *   node scripts/prod-db.mjs npx tsx scripts/set-admin-password.ts <username> <password> # production
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashSecret } from "../src/server/auth/crypto";

config({ path: ".env.local", quiet: true });

const [username = "", password = ""] = process.argv.slice(2);
if (!username || password.length < 8) {
  process.stderr.write("Usage: tsx scripts/set-admin-password.ts <username> <password (8+ characters)>\n");
  process.exit(1);
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error("Set DIRECT_URL (or DATABASE_URL) before running this.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const name = username.trim().toLowerCase();
  const user = await db.adminUser.findUnique({ where: { username: name } });
  if (!user) throw new Error(`No admin with the username ${name}.`);

  await db.adminUser.update({ where: { id: user.id }, data: { passwordHash: await hashSecret(password) } });
  await db.session.updateMany({ where: { actorId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  const cleared = await db.rateLimitHit.deleteMany({
    where: { bucket: { startsWith: "admin-login:", endsWith: `:${name}` } },
  });
  await db.auditLog.create({
    data: {
      schoolId: user.schoolId,
      actorType: "system",
      action: "RESET_ADMIN_PASSWORD",
      entityType: "AdminUser",
      entityId: user.id,
      meta: { by: "set-admin-password script" },
    },
  });
  process.stdout.write(`Password set for ${name}. Cleared ${cleared.count} failed sign-in attempts.\n`);
}

main()
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
