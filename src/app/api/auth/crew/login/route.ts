import { publicRoute } from "@/server/http/handler";
import { crewLogin } from "@/server/services/auth";
import { crewLoginSchema } from "@/lib/api/schemas/auth";

/** POST /api/auth/crew/login: crew ID + PIN + device → `gf_crew` cookie. */
export const POST = publicRoute({ body: crewLoginSchema }, async ({ body, request, ip }) => {
  await crewLogin({ ...body, ip, userAgent: request.headers.get("user-agent") });
  return { ok: true };
});
