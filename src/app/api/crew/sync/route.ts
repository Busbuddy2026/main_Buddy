import { route } from "@/server/http/handler";
import { applyOps, loadCrewPlan } from "@/server/services/crew";
import { syncSchema } from "@/lib/api/schemas/crew";
import { db } from "@/server/db";

/**
 * POST /api/crew/sync { ops } — replay the phone's queued trip events.
 *
 * Each event commits on its own and is applied at most once, so the phone can
 * resend the whole queue after any failure. The answer lists which events
 * landed and carries the fresh plan.
 */
export const POST = route({ app: "crew", body: syncSchema, atomic: false }, async ({ body, ctx }) => {
  const results = await applyOps(ctx, body.ops);
  return { results, plan: await loadCrewPlan(db, ctx.actor.id, ctx.schoolId) };
});
