import { route } from "@/server/http/handler";
import { alertFeed, alertQuery } from "@/server/services/telematics";

/** GET /api/admin/telematics/:busUid/alerts?from&to&type — the tracker's alert feed. */
export const GET = route({ app: "admin", query: alertQuery }, ({ query, ctx }) => alertFeed(ctx, ctx.params.id!, query));
