import { route } from "@/server/http/handler";
import { contacts } from "@/server/services/parent";

/** GET /api/parent/children/:id/contacts — school office and the child's bus crew. */
export const GET = route({ app: "parent" }, ({ ctx }) =>
  contacts(ctx.db, ctx.actor.id, ctx.schoolId, ctx.params.id!),
);
