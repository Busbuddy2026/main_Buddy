import { route } from "@/server/http/handler";
import { vendorVehicles } from "@/server/services/tracking";

/** GET /api/admin/tracking/vehicles — the vendor's trackers and which bus each is linked to. */
export const GET = route({ app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER"] }, ({ ctx }) =>
  vendorVehicles(ctx.schoolId),
);
