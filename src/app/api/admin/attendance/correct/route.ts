import { route } from "@/server/http/handler";
import { correctMark, correctionSchema } from "@/server/services/attendance";

/** POST /api/admin/attendance/correct — the office fixes a mark past the crew's undo window. */
export const POST = route(
  { app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER", "OFFICE_STAFF"], body: correctionSchema },
  async ({ body, ctx }) => {
    await correctMark(ctx, body);
    return { ok: true };
  },
);
