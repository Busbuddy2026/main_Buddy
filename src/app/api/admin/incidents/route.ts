import { route } from "@/server/http/handler";
import { createIncident, incidentCreateSchema, listIncidents } from "@/server/services/safety";

/** GET /api/admin/incidents — newest first, plus any open SOS. */
export const GET = route({ app: "admin" }, ({ ctx }) => listIncidents(ctx.db, ctx.schoolId));

/** POST /api/admin/incidents — log an incident from the office. */
export const POST = route({ app: "admin", body: incidentCreateSchema }, async ({ body, ctx }) => ({
  id: await createIncident(ctx, body),
}));
