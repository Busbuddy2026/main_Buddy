import { route } from "@/server/http/handler";
import { driverStats } from "@/server/services/analytics";

/** GET /api/admin/analytics/drivers — trips, late runs and incidents per driver, last 30 days. */
export const GET = route({ app: "admin" }, ({ ctx }) => driverStats(ctx.db, ctx.schoolId));
