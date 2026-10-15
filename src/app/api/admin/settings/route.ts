import { route } from "@/server/http/handler";
import { loadSettings, settingsUpdateSchema, updateSettings } from "@/server/services/settings";

/** GET /api/admin/settings */
export const GET = route({ app: "admin" }, ({ ctx }) => loadSettings(ctx.db, ctx.schoolId));

/** PATCH /api/admin/settings { profile?, settings? } */
export const PATCH = route(
  { app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER"], body: settingsUpdateSchema },
  ({ body, ctx }) => updateSettings(ctx, body),
);
