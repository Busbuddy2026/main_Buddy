import { route } from "@/server/http/handler";
import { cancelAbsence } from "@/server/services/parent";

/** DELETE /api/parent/absences/:id — withdraw a notice before the trip. */
export const DELETE = route({ app: "parent" }, async ({ ctx }) => {
  await cancelAbsence(ctx, ctx.params.id!);
  return { ok: true };
});
