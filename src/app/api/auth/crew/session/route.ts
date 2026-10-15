import { route } from "@/server/http/handler";
import { ApiError } from "@/server/http/errors";
import { crewMe } from "@/server/services/me";

/** GET /api/auth/crew/session: the signed-in profile, or 401. */
export const GET = route({ app: "crew" }, async ({ ctx }) => {
  const me = await crewMe(ctx.actor.id, ctx.schoolId);
  if (!me) throw new ApiError("UNAUTHENTICATED", "Sign in to continue.");
  return me;
});
