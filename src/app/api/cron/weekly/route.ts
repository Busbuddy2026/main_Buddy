import { db } from "@/server/db";
import { cronAuthorised } from "@/server/http/cron";
import { weeklyDigest } from "@/server/services/parent-alerts";

/**
 * GET /api/cron/weekly — Friday evening (vercel.json): the weekly summary for
 * every parent who turned it on. Needs `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorised(request)) return new Response(null, { status: 401 });
  const schools = await db.school.findMany({ select: { id: true } });
  const results: Record<string, unknown> = {};
  for (const { id } of schools) {
    try {
      results[id] = await weeklyDigest(id);
    } catch (error) {
      results[id] = error instanceof Error ? error.message : "failed";
    }
  }
  return Response.json({ data: { schools: schools.length, results } });
}
