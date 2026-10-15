import { route } from "@/server/http/handler";
import { notFound } from "@/server/http/errors";
import { moveStopSchema } from "@/lib/api/schemas/masters";
import { moveRouteStop, resetCrewPin } from "@/server/services/masters/mutations";
import { loadAdminData } from "@/server/services/masters/view";
import { attach, attachSchema, uploadRequestSchema, uploadUrl } from "@/server/services/documents";
import {
  consentSchema,
  manifestSchema,
  setConsent,
  setManifest,
  setStatus,
  statusSchema,
} from "@/server/services/school-trips";

/**
 * POST /api/admin/:resource/:id/:action
 *
 *   routes/:id/move-stop         { stopId, dir }   reorder a stop on the route
 *   drivers|attendants/:id/reset-pin              issue a new PIN, unlock
 *   <owner>/:id/upload-url       { kind, fileName, size, contentType }
 *   <owner>/:id/documents        { kind, fileName, size, storageKey, … }
 *   school-trips/:id/manifest    { studentIds }    who is going
 *   school-trips/:id/consent     { studentId, given }
 *   school-trips/:id/status      { status }        one step forward, or cancel
 */
export const POST = route({ app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER", "OFFICE_STAFF"] }, async ({ body, ctx }) => {
  const { resource = "", id = "", action = "" } = ctx.params;

  if (resource === "routes" && action === "move-stop") {
    const input = moveStopSchema.parse(body);
    await moveRouteStop(ctx, id, input.stopId, input.dir);
    return { id, data: await loadAdminData(ctx.db, ctx.schoolId) };
  }
  if ((resource === "drivers" || resource === "attendants") && action === "reset-pin") {
    return resetCrewPin(ctx, id);
  }
  if (resource === "school-trips") {
    if (action === "manifest") await setManifest(ctx, id, manifestSchema.parse(body).studentIds);
    else if (action === "consent") await setConsent(ctx, id, consentSchema.parse(body));
    else if (action === "status") await setStatus(ctx, id, statusSchema.parse(body).status);
    else throw notFound("Action");
    return { id, data: await loadAdminData(ctx.db, ctx.schoolId) };
  }
  if (action === "upload-url") {
    return uploadUrl(ctx, resource, id, uploadRequestSchema.parse(body));
  }
  if (action === "documents") {
    const documentId = await attach(ctx, resource, id, attachSchema.parse(body));
    return { id: documentId, data: await loadAdminData(ctx.db, ctx.schoolId) };
  }
  throw notFound("Action");
});
