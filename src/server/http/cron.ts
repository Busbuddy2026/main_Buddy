import "server-only";
import { timingSafeEqual } from "node:crypto";

/** A scheduler call carrying `Authorization: Bearer $CRON_SECRET` (Vercel sends it for its crons). */
export function cronAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const sent = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || sent.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(sent), Buffer.from(secret));
}
