import { route } from "@/server/http/handler";
import { absenceSchema, reportAbsence, upcomingAbsences } from "@/server/services/parent";

/** GET /api/parent/children/:id/absences — upcoming notices. */
export const GET = route({ app: "parent" }, ({ ctx }) =>
  upcomingAbsences(ctx.db, ctx.actor.id, ctx.schoolId, ctx.params.id!),
);

/** POST /api/parent/children/:id/absences { date, morning, evening, reason } */
export const POST = route({ app: "parent", body: absenceSchema }, async ({ body, ctx }) => ({
  id: await reportAbsence(ctx, ctx.params.id!, body),
}));
