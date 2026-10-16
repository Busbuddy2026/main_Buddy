import { route } from "@/server/http/handler";
import { openDashcam } from "@/server/services/tracking";

/**
 * POST /api/admin/cctv/buses/:busId/stream — start the bus's dashcam stream
 * and get the player URL. Audited as CCTV_VIEW. No transaction: the vendor
 * call can take seconds and must not hold a database connection.
 */
export const POST = route(
  { app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER", "OFFICE_STAFF"], atomic: false },
  ({ ctx }) => openDashcam(ctx, ctx.params.id!),
);
