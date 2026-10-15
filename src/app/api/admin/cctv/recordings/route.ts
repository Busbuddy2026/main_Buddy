import { route } from "@/server/http/handler";
import { listRecordings, recordingQuery } from "@/server/services/safety";

/** GET /api/admin/cctv/recordings?busId&day&camera&group */
export const GET = route({ app: "admin", query: recordingQuery }, ({ query, ctx }) =>
  listRecordings(ctx.db, ctx.schoolId, query),
);
