import { db } from "@/server/db";
import { cronAuthorised } from "@/server/http/cron";
import { refreshDriverScores } from "@/server/services/fleet-analytics";
import { nightly } from "@/server/services/fleet-day";

/** A school's fleet for one day takes a few vendor calls per bus. */
export const maxDuration = 300;

/**
 * GET /api/cron/daily — once a night (vercel.json): save yesterday's day for
 * every tracked bus of every school, so analytics read the database, then
 * refresh each driver's 30-day safety score. Needs
 * `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorised(request)) return new Response(null, { status: 401 });
  const schools = await db.gpsDevice.findMany({ where: { busId: { not: null } }, distinct: ["schoolId"], select: { schoolId: true } });
  const results: Record<string, unknown> = {};
  for (const { schoolId } of schools) {
    try {
      results[schoolId] = await nightly(schoolId);
      await refreshDriverScores(schoolId);
    } catch (error) {
      results[schoolId] = error instanceof Error ? error.message : "failed";
    }
  }
  return Response.json({ data: { schools: schools.length, results } });
}
