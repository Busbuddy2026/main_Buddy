import { route } from "@/server/http/handler";
import { changeAnalyticsPin, changePinSchema } from "@/server/auth/analytics-lock";

/** PUT /api/admin/analytics/pin { current, next } — super admins change the analytics PIN. Audited. */
export const PUT = route({ app: "admin", roles: ["SUPER_ADMIN"], atomic: false, body: changePinSchema }, ({ body, ctx }) => changeAnalyticsPin(ctx, body));
