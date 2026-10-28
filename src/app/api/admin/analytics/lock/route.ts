import { route } from "@/server/http/handler";
import { lockAnalytics } from "@/server/auth/analytics-lock";

/** POST /api/admin/analytics/lock — close Analytics again. */
export const POST = route({ app: "admin" }, ({ ctx }) => lockAnalytics(ctx));
