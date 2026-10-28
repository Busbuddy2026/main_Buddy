import { route } from "@/server/http/handler";
import { rebuild, rebuildSchema } from "@/server/services/fleet-day";

/** Reading a month of tracker history can take a minute or two. */
export const maxDuration = 300;

/**
 * POST /api/admin/analytics/rebuild { days } — work out the last N days for
 * every tracked bus from LivePin. Super admins; audited REBUILD_FLEET_DAYS.
 */
export const POST = route({ app: "admin", roles: ["SUPER_ADMIN"], atomic: false, body: rebuildSchema }, ({ body, ctx }) => rebuild(ctx, body));
