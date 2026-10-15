import { route } from "@/server/http/handler";
import { ApiError } from "@/server/http/errors";
import { adminMe } from "@/server/services/me";

/** GET /api/auth/admin/session: the signed-in profile, or 401. */
export const GET = route({ app: "admin" }, async ({ ctx }) => {
  const me = await adminMe(ctx.actor.id, ctx.schoolId);
  if (!me) throw new ApiError("UNAUTHENTICATED", "Sign in to continue.");
  return me;
});
