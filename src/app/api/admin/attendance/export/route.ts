import { route } from "@/server/http/handler";
import { exportCsv, rangeSchema } from "@/server/services/attendance";

/** GET /api/admin/attendance/export?from&to — CSV, one row per student per trip. Audited. */
export const GET = route({ app: "admin", query: rangeSchema }, async ({ query, ctx }) => {
  const csv = await exportCsv(ctx.db, ctx.schoolId, query.from, query.to);
  ctx.audit({ action: "EXPORT_ATTENDANCE", meta: { from: query.from, to: query.to } });
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="attendance-${query.from}-to-${query.to}.csv"`,
      "cache-control": "private, no-store",
    },
  });
});
