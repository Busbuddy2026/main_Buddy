import { route } from "@/server/http/handler";
import { freshenFleet, liveFleet } from "@/server/services/tracking";

/**
 * GET /api/admin/live — every bus with its last GPS fix, trip and ETA, plus
 * route lines. Fresh fixes are pulled from the vendor at most every 30
 * seconds, after the response unless this server's copy has gone stale.
 */
export const GET = route({ app: "admin" }, async ({ ctx }) => {
  await freshenFleet(ctx.schoolId);
  return liveFleet(ctx.db, ctx.schoolId);
});
