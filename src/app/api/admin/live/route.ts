import { route } from "@/server/http/handler";
import { liveFleet, syncFleet } from "@/server/services/tracking";

/**
 * GET /api/admin/live — every bus with its last GPS fix, trip and ETA, plus
 * route lines. Pulls fresh fixes from the vendor at most every 30 seconds.
 */
export const GET = route({ app: "admin" }, async ({ ctx }) => {
  await syncFleet(ctx.schoolId).catch(() => undefined);
  return liveFleet(ctx.db, ctx.schoolId);
});
