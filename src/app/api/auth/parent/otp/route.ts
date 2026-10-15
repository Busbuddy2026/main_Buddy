import { publicRoute } from "@/server/http/handler";
import { parentRequestOtp } from "@/server/services/auth";
import { parentOtpSchema } from "@/lib/api/schemas/auth";

/** POST /api/auth/parent/otp: send a code. Same answer for unknown numbers. */
export const POST = publicRoute({ body: parentOtpSchema }, ({ body, ip }) =>
  parentRequestOtp({ phone: body.phone, ip }),
);
