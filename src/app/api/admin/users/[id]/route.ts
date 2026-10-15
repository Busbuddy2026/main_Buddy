import { route } from "@/server/http/handler";
import { updateUser, userUpdateSchema } from "@/server/services/settings";

/** PATCH /api/admin/users/:id { role?, active? } */
export const PATCH = route({ app: "admin", roles: ["SUPER_ADMIN"], body: userUpdateSchema }, async ({ body, ctx }) => {
  await updateUser(ctx, ctx.params.id!, body);
  return { ok: true };
});
