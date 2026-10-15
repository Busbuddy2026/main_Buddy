import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * One Prisma client per server instance, over the Supabase pooler
 * (DATABASE_URL, port 6543). Dev hot-reload re-evaluates modules, so the
 * client is parked on globalThis to avoid opening a new pool on every edit.
 *
 * A missing DATABASE_URL fails at the first query, not at import, so pages
 * that never touch the database still build.
 */

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Serverless: keep the per-instance pool small; the pooler multiplexes.
    max: 5,
  });
  return new PrismaClient({ adapter });
}

const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createClient> };

export const db = globalForDb.db ?? createClient();

if (process.env.NODE_ENV !== "production") globalForDb.db = db;

/** The client inside an interactive transaction. Services take this. */
export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Run queries together: in parallel on the pooled client, one after another
 * inside a transaction (a transaction holds a single connection, and
 * overlapping queries on one pg connection are deprecated).
 */
export async function inParallel<T extends readonly (() => PromiseLike<unknown>)[]>(
  client: Tx,
  thunks: T,
): Promise<{ -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  type Out = { -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> };
  if ("$transaction" in client) return (await Promise.all(thunks.map((t) => t()))) as Out;
  const out: unknown[] = [];
  for (const t of thunks) out.push(await t());
  return out as Out;
}

/**
 * Serialise "next number" allocation (crew IDs, incident and trip codes) per
 * school: two people adding a record at the same moment would otherwise both
 * read the same highest number. Held until the transaction ends.
 */
export async function lockSequence(client: Tx, key: string): Promise<void> {
  await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}
