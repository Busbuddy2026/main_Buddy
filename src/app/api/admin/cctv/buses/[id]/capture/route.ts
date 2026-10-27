import { CCTV_LIVE_ROLES } from "@/lib/api/policy";
import { route } from "@/server/http/handler";
import { captureSchema, logDashcamCapture } from "@/server/services/tracking";

/**
 * POST /api/admin/cctv/buses/:busId/capture { kind, seconds? } — audit a
 * screenshot or recording of the live dashcam before the browser makes it.
 * Audited as CCTV_SCREENSHOT, CCTV_RECORDING_STARTED or CCTV_RECORDING_SAVED.
 */
export const POST = route({ app: "admin", roles: CCTV_LIVE_ROLES, body: captureSchema }, ({ body, ctx }) =>
  logDashcamCapture(ctx, ctx.params.id!, body),
);
