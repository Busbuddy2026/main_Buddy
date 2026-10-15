import { publicRoute } from "@/server/http/handler";
import { adminLogin } from "@/server/services/auth";
import { adminLoginSchema } from "@/lib/api/schemas/auth";

/** POST /api/auth/admin/login: email + password → `gf_admin` cookie. */
export const POST = publicRoute({ body: adminLoginSchema }, async ({ body, request, ip }) => {
  await adminLogin({ ...body, ip, userAgent: request.headers.get("user-agent") });
  return { ok: true };
});
