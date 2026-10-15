import { route } from "@/server/http/handler";
import { manifest } from "@/server/services/school-trips";

/** GET /api/admin/trip-manifests/:schoolTripId — students, consent and the day's timeline. */
export const GET = route({ app: "admin" }, ({ ctx }) => manifest(ctx.db, ctx.schoolId, ctx.params.id!));
