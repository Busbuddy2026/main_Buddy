import { route } from "@/server/http/handler";
import { createUser, listUsers, userCreateSchema } from "@/server/services/settings";

/** GET /api/admin/users — staff accounts (super admins only). */
export const GET = route({ app: "admin", roles: ["SUPER_ADMIN"] }, ({ ctx }) => listUsers(ctx.db, ctx.schoolId));

/** POST /api/admin/users { name, email, role } — answers with a one-time password. */
export const POST = route({ app: "admin", roles: ["SUPER_ADMIN"], body: userCreateSchema }, ({ body, ctx }) =>
  createUser(ctx, body),
);
