import { route } from "@/server/http/handler";
import { notFound } from "@/server/http/errors";
import { RESOURCES } from "@/server/services/masters/registry";
import { loadAdminData } from "@/server/services/masters/view";

const WRITERS = ["SUPER_ADMIN", "TRANSPORT_MANAGER", "OFFICE_STAFF"] as const;

function resourceOf(name: string | undefined) {
  const resource = RESOURCES[name ?? ""];
  if (!resource) throw notFound("Resource");
  return resource;
}

/** PATCH /api/admin/:resource/:id — full replace of the editable fields. */
export const PATCH = route({ app: "admin", roles: [...WRITERS] }, async ({ body, ctx }) => {
  const resource = resourceOf(ctx.params.resource);
  const id = await resource.update(ctx, ctx.params.id!, resource.schema.parse(body));
  return { id, data: await loadAdminData(ctx.db, ctx.schoolId) };
});

/** DELETE /api/admin/:resource/:id — soft delete; history keeps its references. */
export const DELETE = route({ app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER"] }, async ({ ctx }) => {
  const resource = resourceOf(ctx.params.resource);
  await resource.remove(ctx, ctx.params.id!);
  return { id: ctx.params.id, data: await loadAdminData(ctx.db, ctx.schoolId) };
});
