import { route } from "@/server/http/handler";
import { studentJourney } from "@/server/services/attendance";

/** GET /api/admin/attendance/students/:id — the student's marks today and over the last 30 days. */
export const GET = route({ app: "admin" }, ({ ctx }) => studentJourney(ctx.db, ctx.schoolId, ctx.params.id!));
