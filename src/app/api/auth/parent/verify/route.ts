import { publicRoute } from "@/server/http/handler";
import { parentVerifyOtp } from "@/server/services/auth";
import { parentVerifySchema } from "@/lib/api/schemas/auth";

/** POST /api/auth/parent/verify: phone + code → `gf_parent` cookie. */
export const POST = publicRoute({ body: parentVerifySchema }, async ({ body, request, ip }) => {
  await parentVerifyOtp({ ...body, ip, userAgent: request.headers.get("user-agent") });
  return { ok: true };
});
