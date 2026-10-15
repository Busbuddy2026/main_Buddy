import { route } from "@/server/http/handler";
import { markNotificationsRead } from "@/server/services/parent";

/** POST /api/parent/notifications/read — mark everything seen. */
export const POST = route({ app: "parent" }, async ({ ctx }) => {
  await markNotificationsRead(ctx);
  return { ok: true };
});
