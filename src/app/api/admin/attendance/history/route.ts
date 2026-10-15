import { route } from "@/server/http/handler";
import { rangeSchema, summarize } from "@/server/services/attendance";

/** GET /api/admin/attendance/history?from&to — one row per school day, newest first. */
export const GET = route({ app: "admin", query: rangeSchema }, async ({ query, ctx }) => ({
  ...query,
  days: await summarize(ctx.db, ctx.schoolId, query.from, query.to),
}));
