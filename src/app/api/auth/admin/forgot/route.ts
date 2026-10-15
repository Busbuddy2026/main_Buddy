import { publicRoute } from "@/server/http/handler";
import { adminForgotPassword } from "@/server/services/auth";
import { adminForgotSchema } from "@/lib/api/schemas/auth";

/** POST /api/auth/admin/forgot: always 200, whether or not the email exists. */
export const POST = publicRoute({ body: adminForgotSchema }, ({ body, ip }) =>
  adminForgotPassword({ email: body.email, ip }),
);
