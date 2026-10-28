import { route } from "@/server/http/handler";
import { punctuality, rangeQuery } from "@/server/services/fleet-analytics";

/** GET /api/admin/analytics/punctuality?from&to — arrival against the bell, usual stop times, ride lengths. */
export const GET = route({ app: "admin", atomic: false, query: rangeQuery }, ({ query, ctx }) => punctuality(ctx, query));
