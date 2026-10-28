import { route } from "@/server/http/handler";
import { requireAnalytics } from "@/server/auth/analytics-lock";
import { fleetHealth } from "@/server/services/fleet-analytics";

/** GET /api/admin/analytics/fleet — bus usage, service due and route suggestions (last 30 days). */
export const GET = route({ app: "admin", atomic: false }, async ({ ctx }) => {
  await requireAnalytics();
  return fleetHealth(ctx);
});
