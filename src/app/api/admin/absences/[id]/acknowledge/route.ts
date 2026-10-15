import { route } from "@/server/http/handler";
import { acknowledgeAbsence } from "@/server/services/attendance";

/** POST /api/admin/absences/:id/acknowledge — the office has seen the parent's notice. */
export const POST = route({ app: "admin" }, async ({ ctx }) => {
  await acknowledgeAbsence(ctx, ctx.params.id!);
  return { ok: true };
});
