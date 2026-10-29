import { z } from "zod";

/** Request bodies for the sign-in endpoints. Shared with the login forms. */

export const adminLoginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username.").max(40),
  password: z.string().min(1, "Enter your password.").max(200),
});

/** Ten-digit Indian mobile number, as typed (spaces allowed). */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number."));

export const parentLoginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "Enter your password.").max(200),
});

export const crewLoginSchema = z.object({
  crewId: z.string().trim().min(4, "Enter your crew ID.").max(40),
  pin: z.string().regex(/^\d{4,6}$/, "Enter your 4-digit PIN."),
  deviceId: z.string().min(8).max(100),
});
