import { z } from "zod";
import { route } from "@/server/http/handler";
import { accountSummary, livepin, saveAccount } from "@/server/vendors/livepin";

const LEADS = ["SUPER_ADMIN", "TRANSPORT_MANAGER"] as const;

/** GET /api/admin/tracking/account — provider, masked key and secret, last check. */
export const GET = route({ app: "admin", roles: [...LEADS] }, ({ ctx }) => accountSummary(ctx.schoolId));

/** PUT /api/admin/tracking/account { apiKey, apiSecret, baseUrl? } — checked by signing in before saving. */
export const PUT = route(
  {
    app: "admin",
    roles: [...LEADS],
    atomic: false,
    body: z.object({
      apiKey: z.string().trim().min(8, "Enter the API key.").max(200),
      apiSecret: z.string().trim().min(8, "Enter the API secret.").max(400),
      baseUrl: z.url().optional(),
    }),
  },
  async ({ body, ctx }) => {
    await saveAccount(ctx.schoolId, body);
    ctx.audit({ action: "TRACKING_ACCOUNT_SAVED", meta: { provider: "LIVEPIN" } });
    return accountSummary(ctx.schoolId);
  },
);

/** POST /api/admin/tracking/account — test the stored credentials. */
export const POST = route({ app: "admin", roles: [...LEADS], atomic: false }, async ({ ctx }) => {
  await (await livepin(ctx.schoolId)).test();
  ctx.audit({ action: "TRACKING_ACCOUNT_TESTED" });
  return accountSummary(ctx.schoolId);
});
