import { route } from "@/server/http/handler";
import { rangeQuery, safety } from "@/server/services/fleet-analytics";

/** GET /api/admin/analytics/safety?from&to — driver scores, overspeed hotspots, after-hours use and detours. */
export const GET = route({ app: "admin", atomic: false, query: rangeQuery }, ({ query, ctx }) => safety(ctx, query));
