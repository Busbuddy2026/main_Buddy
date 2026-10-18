import { route } from "@/server/http/handler";
import { liveDetail, settingsSchema, updateSettings } from "@/server/services/telematics";

/** GET /api/admin/telematics/:busUid/settings */
export const GET = route({ app: "admin" }, async ({ ctx }) => (await liveDetail(ctx, ctx.params.id!)).settings);

/**
 * PUT /api/admin/telematics/:busUid/settings — alert switches, overspeed
 * limit, reporting interval, applied at the vendor. No transaction: the vendor
 * calls must not hold a database connection.
 */
export const PUT = route(
  { app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER"], body: settingsSchema, atomic: false },
  ({ body, ctx }) => updateSettings(ctx, ctx.params.id!, body),
);
