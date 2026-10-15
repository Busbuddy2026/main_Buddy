import { route } from "@/server/http/handler";
import { listAbsences, todaySummary } from "@/server/services/attendance";
import { localDate } from "@/lib/time";

/** GET /api/admin/attendance/today: today's tallies and open absence notices. */
export const GET = route({ app: "admin" }, async ({ ctx }) => ({
  summary: await todaySummary(ctx.db, ctx.schoolId),
  absences: await listAbsences(ctx.db, ctx.schoolId, localDate()),
}));
