import { route } from "@/server/http/handler";
import { childToday } from "@/server/services/parent";

/** GET /api/parent/children/:id/today — the trip that matters right now. */
export const GET = route({ app: "parent" }, ({ ctx }) =>
  childToday(ctx.db, { schoolId: ctx.schoolId, guardianId: ctx.actor.id }, ctx.params.id!),
);
