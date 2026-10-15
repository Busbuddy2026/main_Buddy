import { auditDirect, publicRoute } from "@/server/http/handler";
import { endSession } from "@/server/auth/session";

/** POST /api/auth/crew/logout: revoke the session and clear `gf_crew`. */
export const POST = publicRoute({}, async ({ ip }) => {
  const ended = await endSession("crew");
  if (ended) {
    await auditDirect({
      schoolId: ended.schoolId, actorType: "crew", actorId: ended.actorId, action: "LOGOUT", ip,
    });
  }
  return { ok: true };
});
