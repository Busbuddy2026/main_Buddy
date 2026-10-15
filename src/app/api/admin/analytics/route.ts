import { z } from "zod";
import { route } from "@/server/http/handler";
import { overview } from "@/server/services/analytics";

/** GET /api/admin/analytics?days=30 */
export const GET = route(
  { app: "admin", query: z.object({ days: z.coerce.number().int().min(7).max(365).default(30) }) },
  ({ query, ctx }) => overview(ctx.db, ctx.schoolId, query.days),
);
