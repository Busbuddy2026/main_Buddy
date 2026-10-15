import { route } from "@/server/http/handler";
import { ApiError } from "@/server/http/errors";
import { parentMe } from "@/server/services/me";

/** GET /api/auth/parent/session: the signed-in profile, or 401. */
export const GET = route({ app: "parent" }, async ({ ctx }) => {
  const me = await parentMe(ctx.actor.id, ctx.schoolId);
  if (!me) throw new ApiError("UNAUTHENTICATED", "Sign in to continue.");
  return me;
});
