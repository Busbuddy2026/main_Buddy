import { route } from "@/server/http/handler";
import { notFound } from "@/server/http/errors";
import { RESOURCES } from "@/server/services/masters/registry";
import { loadAdminData } from "@/server/services/masters/view";

/**
 * POST /api/admin/{buses,students,drivers,attendants,routes,stops,school-trips}
 *
 * Creates the record and answers with its id and the refreshed master data,
 * so the console re-renders every table the change touched (assigning a
 * driver to a bus changes both rows).
 */
export const POST = route({ app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER", "OFFICE_STAFF"] }, async ({ body, ctx }) => {
  const resource = RESOURCES[ctx.params.resource ?? ""];
  if (!resource) throw notFound("Resource");
  const created = await resource.create(ctx, resource.schema.parse(body));
  const extra = typeof created === "string" ? { id: created } : created;
  return { ...extra, data: await loadAdminData(ctx.db, ctx.schoolId) };
});
