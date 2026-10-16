import { route } from "@/server/http/handler";
import { linkDevice, linkSchema, vendorVehicles } from "@/server/services/tracking";

/** PUT /api/admin/tracking/links { busId, vehicleId|null } — link or unlink a tracker. */
export const PUT = route(
  { app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER"], body: linkSchema },
  async ({ body, ctx }) => {
    await linkDevice(ctx, body);
    return { ok: true };
  },
);

/** GET is the same list as /tracking/vehicles, for convenience after a change. */
export const GET = route({ app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER"] }, ({ ctx }) =>
  vendorVehicles(ctx.schoolId),
);
