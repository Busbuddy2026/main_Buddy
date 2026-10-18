import { route } from "@/server/http/handler";
import { todayTrails } from "@/server/services/telematics";

/** GET /api/admin/live/trails — the road each linked bus has driven today, for the live maps. */
export const GET = route({ app: "admin", atomic: false }, ({ ctx }) => todayTrails(ctx.db, ctx.schoolId));
