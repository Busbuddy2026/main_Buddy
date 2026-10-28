import { route } from "@/server/http/handler";
import { requireAnalytics } from "@/server/auth/analytics-lock";
import { punctuality, rangeQuery } from "@/server/services/fleet-analytics";

/** GET /api/admin/analytics/punctuality?from&to — arrival against the bell, usual stop times, ride lengths. */
export const GET = route({ app: "admin", atomic: false, query: rangeQuery }, async ({ query, ctx }) => {
  await requireAnalytics();
  return punctuality(ctx, query);
});
