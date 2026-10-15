import { route } from "@/server/http/handler";
import { raiseCameraTicket } from "@/server/services/safety";

/** POST /api/admin/cctv/buses/:busId/ticket — a tracked camera-fault incident. */
export const POST = route({ app: "admin" }, async ({ ctx }) => ({ id: await raiseCameraTicket(ctx, ctx.params.id!) }));
