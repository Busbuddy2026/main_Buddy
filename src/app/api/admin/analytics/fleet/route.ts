import { route } from "@/server/http/handler";
import { fleetHealth } from "@/server/services/fleet-analytics";

/** GET /api/admin/analytics/fleet — bus usage, service due and route suggestions (last 30 days). */
export const GET = route({ app: "admin", atomic: false }, ({ ctx }) => fleetHealth(ctx));
