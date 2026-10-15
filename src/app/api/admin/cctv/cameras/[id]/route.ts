import { route } from "@/server/http/handler";
import { cameraUpdateSchema, setCameraStatus } from "@/server/services/safety";

/** PATCH /api/admin/cctv/cameras/:id { status } — until devices report their own health. */
export const PATCH = route({ app: "admin", body: cameraUpdateSchema }, async ({ body, ctx }) => {
  await setCameraStatus(ctx, ctx.params.id!, body.status);
  return { ok: true };
});
