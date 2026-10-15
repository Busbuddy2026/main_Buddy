import { route } from "@/server/http/handler";
import { logCameraView } from "@/server/services/safety";

/** POST /api/admin/cctv/cameras/:id/view — every camera view is audited. */
export const POST = route({ app: "admin", atomic: false }, async ({ ctx }) => {
  await logCameraView(ctx, ctx.params.id!);
  return { ok: true };
});
