import { publicRoute } from "@/server/http/handler";
import { adminResetPassword } from "@/server/services/auth";
import { adminResetSchema } from "@/lib/api/schemas/auth";

/** POST /api/auth/admin/reset: single-use token + new password. */
export const POST = publicRoute({ body: adminResetSchema }, async ({ body, ip }) => {
  await adminResetPassword({ ...body, ip });
  return { ok: true };
});
