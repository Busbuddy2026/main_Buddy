import { z } from "zod";
import { route } from "@/server/http/handler";
import { dayDetail } from "@/server/services/telematics";
import { localDate } from "@/lib/time";

/** GET /api/admin/telematics/:busUid/day?date=YYYY-MM-DD — daily report and track. */
export const GET = route(
  { app: "admin", query: z.object({ date: z.iso.date().optional() }) },
  ({ query, ctx }) => dayDetail(ctx, ctx.params.id!, query.date ?? localDate()),
);
