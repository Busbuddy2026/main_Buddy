import { route } from "@/server/http/handler";
import { loadCrewPlan } from "@/server/services/crew";

/** GET /api/crew/plan: today's bus, stops, riders and marks for the signed-in crew. */
export const GET = route({ app: "crew" }, ({ ctx }) => loadCrewPlan(ctx.db, ctx.actor.id, ctx.schoolId));
