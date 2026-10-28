import { route } from "@/server/http/handler";
import { trackedBusIds } from "@/server/services/fleet-day";
import { typicalStopTimes } from "@/server/services/fleet-analytics";

/** GET /api/admin/analytics/stop-times — usual morning and evening time per stop ("07:49"), last 20 days. */
export const GET = route({ app: "admin", atomic: false }, async ({ ctx }) => {
  const school = await ctx.db.school.findUniqueOrThrow({ where: { id: ctx.schoolId }, select: { timezone: true } });
  const times = await typicalStopTimes(ctx.db, await trackedBusIds(ctx.db, ctx.schoolId), school.timezone);
  return Object.fromEntries(times);
});
