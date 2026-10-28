import { route } from "@/server/http/handler";
import { pinSchema, unlockAnalytics } from "@/server/auth/analytics-lock";

/** POST /api/admin/analytics/unlock { pin } — open Analytics for 30 minutes. Rate limited; audited. */
export const POST = route({ app: "admin", atomic: false, body: pinSchema }, ({ body, ctx }) => unlockAnalytics(ctx, body));
