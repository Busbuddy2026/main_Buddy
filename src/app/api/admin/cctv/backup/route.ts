import { route } from "@/server/http/handler";
import { backupRecordings, backupSchema } from "@/server/services/safety";

/** POST /api/admin/cctv/backup { busId?, day? } */
export const POST = route({ app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER"], body: backupSchema }, ({ body, ctx }) =>
  backupRecordings(ctx, body),
);
