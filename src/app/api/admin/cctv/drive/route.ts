import { route } from "@/server/http/handler";
import { driveSchema, setDrive } from "@/server/services/safety";

/** PUT /api/admin/cctv/drive { connected, account? } — the backup target. */
export const PUT = route({ app: "admin", roles: ["SUPER_ADMIN", "TRANSPORT_MANAGER"], body: driveSchema }, ({ body, ctx }) =>
  setDrive(ctx, body),
);
