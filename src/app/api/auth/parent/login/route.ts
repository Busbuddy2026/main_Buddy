import { publicRoute } from "@/server/http/handler";
import { parentLogin } from "@/server/services/auth";
import { parentLoginSchema } from "@/lib/api/schemas/auth";

/** POST /api/auth/parent/login: mobile number + parent password → `gf_parent` cookie. */
export const POST = publicRoute({ body: parentLoginSchema }, async ({ body, request, ip }) => {
  await parentLogin({ ...body, ip, userAgent: request.headers.get("user-agent") });
  return { ok: true };
});
