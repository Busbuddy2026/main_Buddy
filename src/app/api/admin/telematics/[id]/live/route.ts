import { route } from "@/server/http/handler";
import { liveDetail } from "@/server/services/telematics";

/** GET /api/admin/telematics/:busUid/live — live readings, sensors, health, settings. */
export const GET = route({ app: "admin" }, ({ ctx }) => liveDetail(ctx, ctx.params.id!));
