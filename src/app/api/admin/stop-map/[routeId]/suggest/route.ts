import { route } from "@/server/http/handler";
import { suggestQuery, suggestStops } from "@/server/services/stop-map";

/**
 * GET /api/admin/stop-map/:routeId/suggest?bus&date&trip — a suggested pin for
 * each unpinned stop, from OpenStreetMap snapped onto the trip. Slow the first
 * time (one lookup a second); cached after.
 */
export const GET = route({ app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER"], query: suggestQuery }, ({ query, ctx }) =>
  suggestStops(ctx, ctx.params.routeId!, query),
);
