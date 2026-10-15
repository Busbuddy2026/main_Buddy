import { route } from "@/server/http/handler";
import { loadAdminData } from "@/server/services/masters/view";

/** GET /api/admin/masters: every master record, shaped for the console. */
export const GET = route({ app: "admin" }, ({ ctx }) => loadAdminData(ctx.db, ctx.schoolId));
