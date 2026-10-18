import { route } from "@/server/http/handler";
import { vehicleSettings } from "@/server/services/telematics";

/** GET /api/admin/tracking/vehicles/:vehicleId/settings — a tracker's alert settings and interval, from LivePin. */
export const GET = route({ app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER"], atomic: false }, ({ ctx }) =>
  vehicleSettings(ctx.schoolId, ctx.params.id!),
);
