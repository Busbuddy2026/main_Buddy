import { route } from "@/server/http/handler";
import { resetUserPassword } from "@/server/services/settings";

/** POST /api/admin/users/:id/reset-password — answers with a one-time password. */
export const POST = route({ app: "admin", roles: ["SUPER_ADMIN"] }, ({ ctx }) => resetUserPassword(ctx, ctx.params.id!));
