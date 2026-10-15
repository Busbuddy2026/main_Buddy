import { auditDirect, publicRoute } from "@/server/http/handler";
import { endSession } from "@/server/auth/session";

/** POST /api/auth/parent/logout: revoke the session and clear `gf_parent`. */
export const POST = publicRoute({}, async ({ ip }) => {
  const ended = await endSession("parent");
  if (ended) {
    await auditDirect({
      schoolId: ended.schoolId, actorType: "guardian", actorId: ended.actorId, action: "LOGOUT", ip,
    });
  }
  return { ok: true };
});
