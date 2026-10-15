import { route } from "@/server/http/handler";
import { listCameras } from "@/server/services/safety";

/** GET /api/admin/cctv/cameras — registry and health, grouped by bus. */
export const GET = route({ app: "admin" }, ({ ctx }) => listCameras(ctx.db, ctx.schoolId));
