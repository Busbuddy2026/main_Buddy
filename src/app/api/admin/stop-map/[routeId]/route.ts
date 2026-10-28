import { z } from "zod";
import { route } from "@/server/http/handler";
import { saveStopMap, saveStopMapSchema, stopMapData, yesterday } from "@/server/services/stop-map";

const LEADS = ["SUPER_ADMIN", "TRANSPORT_MANAGER"] as const;

/** GET /api/admin/stop-map/:routeId?bus&date — a day's trips, pauses and the route's stops, to map them. */
export const GET = route(
  { app: "admin", roles: [...LEADS], query: z.object({ bus: z.string().max(40).optional(), date: z.iso.date().optional() }) },
  ({ query, ctx }) => stopMapData(ctx, ctx.params.routeId!, query.bus, query.date ?? yesterday()),
);

/**
 * PUT /api/admin/stop-map/:routeId { busId, date, trip, stops } — save the
 * confirmed pins, order and times. Audited MAP_ROUTE_STOPS. Not one
 * transaction end to end: the tracker read comes first, the writes commit together.
 */
export const PUT = route({ app: "admin", roles: [...LEADS], atomic: false, body: saveStopMapSchema }, ({ body, ctx }) =>
  saveStopMap(ctx, ctx.params.routeId!, body),
);
