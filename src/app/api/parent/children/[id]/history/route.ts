import { route } from "@/server/http/handler";
import { childHistory } from "@/server/services/parent";

/** GET /api/parent/children/:id/history — the last two weeks, newest first. */
export const GET = route({ app: "parent" }, ({ ctx }) =>
  childHistory(ctx.db, ctx.actor.id, ctx.schoolId, ctx.params.id!),
);
