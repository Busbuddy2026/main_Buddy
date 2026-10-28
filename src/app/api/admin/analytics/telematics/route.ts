import { z } from "zod";
import { route } from "@/server/http/handler";
import { requireAnalytics } from "@/server/auth/analytics-lock";
import { fleetDay } from "@/server/services/telematics";
import { localDate } from "@/lib/time";

/** GET /api/admin/analytics/telematics?date — each linked bus's day from the tracker. */
export const GET = route(
  { app: "admin", query: z.object({ date: z.iso.date().optional() }) },
  async ({ query, ctx }) => {
    await requireAnalytics();
    return fleetDay(ctx.db, ctx.schoolId, query.date ?? localDate());
  },
);
