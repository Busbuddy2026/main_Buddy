import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import { syncFleet } from "@/server/services/tracking";

/**
 * GET /api/cron/livepin — pull every school's trackers. Called by Vercel Cron
 * (vercel.json), which sends `Authorization: Bearer $CRON_SECRET`.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const sent = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || sent.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(sent), Buffer.from(secret));
}

export async function GET(request: Request): Promise<Response> {
  if (!authorised(request)) return new Response(null, { status: 401 });
  const schools = await db.gpsDevice.findMany({ where: { busId: { not: null } }, distinct: ["schoolId"], select: { schoolId: true } });
  const results: Record<string, number | string> = {};
  for (const { schoolId } of schools) {
    try {
      results[schoolId] = (await syncFleet(schoolId, true)).synced;
    } catch (error) {
      results[schoolId] = error instanceof Error ? error.message : "failed";
    }
  }
  return Response.json({ data: { schools: schools.length, results } });
}
