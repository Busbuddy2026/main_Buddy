import { db } from "@/server/db";
import { cronAuthorised } from "@/server/http/cron";
import { syncFleet } from "@/server/services/tracking";

/**
 * GET /api/cron/livepin — pull every school's trackers. Called every minute by
 * a scheduler (Vercel Pro cron or an external one) with
 * `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorised(request)) return new Response(null, { status: 401 });
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
