import { route } from "@/server/http/handler";
import { efficiency, rangeQuery } from "@/server/services/fleet-analytics";

/** GET /api/admin/analytics/efficiency?from&to — fuel, cost and idling per bus (estimates). */
export const GET = route({ app: "admin", atomic: false, query: rangeQuery }, ({ query, ctx }) => efficiency(ctx, query));
