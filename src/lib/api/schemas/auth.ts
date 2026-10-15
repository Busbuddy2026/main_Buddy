import { z } from "zod";

/** Request bodies for the sign-in endpoints. Shared with the login forms. */

export const adminLoginSchema = z.object({
  email: z.email("Enter a valid email.").max(200),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const adminForgotSchema = z.object({
  email: z.email("Enter a valid email.").max(200),
});

export const adminResetSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

/** Ten-digit Indian mobile number, as typed (spaces allowed). */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number."));

export const parentOtpSchema = z.object({ phone: phoneSchema });

export const parentVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export const crewLoginSchema = z.object({
  crewId: z.string().trim().min(4, "Enter your crew ID.").max(40),
  pin: z.string().regex(/^\d{4,6}$/, "Enter your 4-digit PIN."),
  deviceId: z.string().min(8).max(100),
});
