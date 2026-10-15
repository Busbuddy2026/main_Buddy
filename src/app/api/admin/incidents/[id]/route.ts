import { route } from "@/server/http/handler";
import { incidentDetail, incidentUpdateSchema, updateIncident } from "@/server/services/safety";

/** GET /api/admin/incidents/:idOrCode — detail with its timeline. */
export const GET = route({ app: "admin" }, ({ ctx }) => incidentDetail(ctx.db, ctx.schoolId, ctx.params.id!));

/** PATCH /api/admin/incidents/:id { status?, severity?, assignedTo?, note? } */
export const PATCH = route({ app: "admin", body: incidentUpdateSchema }, async ({ body, ctx }) => {
  await updateIncident(ctx, ctx.params.id!, body);
  return incidentDetail(ctx.db, ctx.schoolId, ctx.params.id!);
});
