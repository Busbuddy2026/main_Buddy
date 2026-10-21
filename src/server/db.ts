import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * One Prisma client per server instance, over the Supabase pooler
 * (see `databaseUrl`, port 6543). Dev hot-reload re-evaluates modules, so the
 * client is parked on globalThis to avoid opening a new pool on every edit.
 *
 * A missing database URL fails at the first query, not at import, so pages
 * that never touch the database still build.
 */

/**
 * DATABASE_URL, or on Vercel the Supabase integration's pooled URL
 * (POSTGRES_PRISMA_URL, port 6543), which follows password rotations. Those
 * carry `sslmode=require`; node-pg now reads that as "verify the certificate",
 * which Supabase's pooler cannot pass, so ask for libpq's meaning instead:
 * encrypted, not verified.
 */
export function databaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  const raw = env.DATABASE_URL || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL;
  if (!raw) return undefined;
  const url = new URL(raw);
  const mode = url.searchParams.get("sslmode");
  if (mode && mode !== "disable" && mode !== "verify-full") url.searchParams.set("uselibpqcompat", "true");
  return url.toString();
}

function createClient() {
  const adapter = new PrismaPg({
    connectionString: databaseUrl(),
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
