import { auditDirect, publicRoute } from "@/server/http/handler";
import { endSession } from "@/server/auth/session";

/** POST /api/auth/admin/logout: revoke the session and clear `gf_admin`. */
export const POST = publicRoute({}, async ({ ip }) => {
  const ended = await endSession("admin");
  if (ended) {
    await auditDirect({
      schoolId: ended.schoolId, actorType: "admin", actorId: ended.actorId, action: "LOGOUT", ip,
    });
  }
  return { ok: true };
});
