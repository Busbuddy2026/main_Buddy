import { route } from "@/server/http/handler";
import { requireAnalytics } from "@/server/auth/analytics-lock";
import { markServiced, serviceSchema } from "@/server/services/fleet-analytics";

/** POST /api/admin/analytics/service { busId, on? } — record a service; audited BUS_SERVICED. */
export const POST = route({ app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER"], body: serviceSchema }, async ({ body, ctx }) => {
  await requireAnalytics();
  return markServiced(ctx, body);
});
