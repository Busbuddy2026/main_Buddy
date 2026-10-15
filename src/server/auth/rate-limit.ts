import { ApiError } from "@/server/http/errors";
import type { Tx } from "@/server/db";

/**
 * Sliding-window limit kept in Postgres. Serverless instances share no
 * memory, so an in-process counter would reset on every cold start.
 *
 * Each call records a hit, then counts the window. A caller over the limit
 * gets RATE_LIMITED; its hit still counts, so hammering does not help.
 */
export async function limit(
  db: Tx,
  bucket: string,
  max: number,
  windowMs: number,
  message = "Too many attempts. Wait a few minutes and try again.",
): Promise<void> {
  const since = new Date(Date.now() - windowMs);
  await db.rateLimitHit.create({ data: { bucket } });
  const count = await db.rateLimitHit.count({
    where: { bucket, createdAt: { gte: since } },
  });
  if (count > max) throw new ApiError("RATE_LIMITED", message);

  // Housekeeping: about one call in fifty prunes day-old hits.
  if (Math.random() < 0.02) {
    await db.rateLimitHit.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } },
    });
  }
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** Refuse when `bucket` already has `max` hits in the window. Records nothing. */
export async function checkLimit(
  db: Tx,
  bucket: string,
  max: number,
  windowMs: number,
  message = "Too many attempts. Wait a few minutes and try again.",
): Promise<void> {
  const count = await db.rateLimitHit.count({
    where: { bucket, createdAt: { gte: new Date(Date.now() - windowMs) } },
  });
  if (count >= max) throw new ApiError("RATE_LIMITED", message);
}

/** Record one hit, e.g. a failed sign-in. */
export async function recordHit(db: Tx, bucket: string): Promise<void> {
  await db.rateLimitHit.create({ data: { bucket } });
}
