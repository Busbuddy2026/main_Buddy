import { route } from "@/server/http/handler";
import { busTripDetail, tripQuery } from "@/server/services/bus-trip";

/**
 * GET /api/admin/telematics/:busUid/trip?date&trip — one trip of a bus: the
 * day's trips, stops with children, alerts; efficiency and the last 30 days
 * only when Analytics is unlocked.
 */
export const GET = route({ app: "admin", atomic: false, query: tripQuery }, ({ query, ctx }) => busTripDetail(ctx, ctx.params.id!, query));
