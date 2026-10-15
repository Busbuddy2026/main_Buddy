import { route } from "@/server/http/handler";
import { logRecordingView } from "@/server/services/safety";

/** POST /api/admin/cctv/recordings/:id/view — every recording view is audited. */
export const POST = route({ app: "admin", atomic: false }, async ({ ctx }) => {
  await logRecordingView(ctx, ctx.params.id!);
  return { ok: true };
});
