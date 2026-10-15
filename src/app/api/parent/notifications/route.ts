import { route } from "@/server/http/handler";
import { listNotifications } from "@/server/services/parent";

/** GET /api/parent/notifications — the latest 100, newest first. */
export const GET = route({ app: "parent" }, ({ ctx }) => listNotifications(ctx.db, ctx.actor.id, ctx.schoolId));
