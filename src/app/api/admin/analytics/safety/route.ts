import { route } from "@/server/http/handler";
import { requireAnalytics } from "@/server/auth/analytics-lock";
import { rangeQuery, safety } from "@/server/services/fleet-analytics";

/** GET /api/admin/analytics/safety?from&to — driver scores, overspeed hotspots, after-hours use and detours. */
export const GET = route({ app: "admin", atomic: false, query: rangeQuery }, async ({ query, ctx }) => {
  await requireAnalytics();
  return safety(ctx, query);
});
