import { z } from "zod";
import { route } from "@/server/http/handler";
import { dayTrips } from "@/server/services/telematics";
import { localDate } from "@/lib/time";

/** GET /api/admin/telematics/:busUid/trips?date=YYYY-MM-DD — the day cut into trips, with stops and road. */
export const GET = route(
  { app: "admin", atomic: false, query: z.object({ date: z.iso.date().optional() }) },
  ({ query, ctx }) => dayTrips(ctx, ctx.params.id!, query.date ?? localDate()),
);
