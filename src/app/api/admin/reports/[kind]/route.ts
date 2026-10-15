import { route } from "@/server/http/handler";
import { notFound } from "@/server/http/errors";
import { exportCsv, rangeSchema } from "@/server/services/attendance";
import { incidentsCsv, tripsCsv } from "@/server/services/analytics";

const REPORTS = { attendance: exportCsv, trips: tripsCsv, incidents: incidentsCsv } as const;

/** GET /api/admin/reports/{attendance|trips|incidents}?from&to — CSV. Audited. */
export const GET = route({ app: "admin", query: rangeSchema }, async ({ query, ctx }) => {
  const kind = ctx.params.kind as keyof typeof REPORTS;
  const build = REPORTS[kind];
  if (!build) throw notFound("Report");
  const body = await build(ctx.db, ctx.schoolId, query.from, query.to);
  ctx.audit({ action: "EXPORT_REPORT", meta: { kind, from: query.from, to: query.to } });
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${kind}-${query.from}-to-${query.to}.csv"`,
      "cache-control": "private, no-store",
    },
  });
});
