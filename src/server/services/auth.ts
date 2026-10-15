import "server-only";
import { db } from "@/server/db";
import { DUMMY_HASH, hashSecret, newOtp, newToken, sha256, verifySecret } from "@/server/auth/crypto";
import { HOUR, MINUTE, checkLimit, limit, recordHit } from "@/server/auth/rate-limit";
import { revokeAllFor, startSession } from "@/server/auth/session";
import { auditDirect } from "@/server/http/handler";
import { ApiError } from "@/server/http/errors";

/**
 * Sign-in for the three apps. Every refusal reads the same whether or not the
 * account exists (API.md: never reveal whether a phone or email exists), and
 * every attempt is rate limited in the database.
 */

const devEcho = () => process.env.DEV_ECHO_SECRETS === "1" && process.env.NODE_ENV !== "production";

const BAD_LOGIN = "Those details did not match.";

// ── Admin: email + password ────────────────────────────────────────────────

export async function adminLogin(input: {
  email: string;
  password: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  // Failed attempts only: signing in and out all day must not lock anyone out.
  const bucket = `admin-login:${input.ip ?? "?"}:${email}`;
  await checkLimit(db, bucket, 5, 15 * MINUTE);

  const user = await db.adminUser.findFirst({ where: { email, deletedAt: null } });
  // Hash even when there is no user, so timing does not reveal the account.
  const ok = await verifySecret(input.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !ok) {
    await recordHit(db, bucket);
    if (user) {
      await auditDirect({
        schoolId: user.schoolId, actorType: "admin", actorId: user.id,
        action: "LOGIN_FAILED", entityType: "AdminUser", entityId: user.id, ip: input.ip,
      });
    }
    throw new ApiError("UNAUTHENTICATED", BAD_LOGIN);
  }

  await startSession("admin", user, input.userAgent);
  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await auditDirect({
    schoolId: user.schoolId, actorType: "admin", actorId: user.id,
    action: "LOGIN", entityType: "AdminUser", entityId: user.id, ip: input.ip,
  });
}

/** Always succeeds outwardly. In development the reset token is echoed back. */
export async function adminForgotPassword(input: {
  email: string;
  ip: string | null;
}): Promise<{ devResetToken?: string }> {
  const email = input.email.trim().toLowerCase();
  await limit(db, `admin-forgot:${input.ip ?? "?"}`, 5, HOUR);
  const user = await db.adminUser.findFirst({ where: { email, deletedAt: null } });
  if (!user) return {};

  const token = newToken();
  await db.passwordReset.create({
    data: { adminUserId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + HOUR) },
  });
  await auditDirect({
    schoolId: user.schoolId, actorType: "admin", actorId: user.id,
    action: "PASSWORD_RESET_REQUESTED", entityType: "AdminUser", entityId: user.id, ip: input.ip,
  });
  // TODO(email): send `${origin}/admin?reset=${token}` once an email provider is wired.
  return devEcho() ? { devResetToken: token } : {};
}

export async function adminResetPassword(input: {
  token: string;
  password: string;
  ip: string | null;
}): Promise<void> {
  await limit(db, `admin-reset:${input.ip ?? "?"}`, 10, HOUR);
  const reset = await db.passwordReset.findUnique({ where: { tokenHash: sha256(input.token) } });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
    throw new ApiError("VALIDATION", "This reset link has expired. Request a new one.");
  }
  const user = await db.adminUser.update({
    where: { id: reset.adminUserId },
    data: { passwordHash: await hashSecret(input.password) },
  });
  await db.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
  // A reset signs out every other device.
  await revokeAllFor(user.id);
  await auditDirect({
    schoolId: user.schoolId, actorType: "admin", actorId: user.id,
    action: "PASSWORD_RESET", entityType: "AdminUser", entityId: user.id, ip: input.ip,
  });
}

// ── Parent: phone + one-time code ──────────────────────────────────────────

const OTP_TTL_MS = 5 * MINUTE;
const OTP_MAX_ATTEMPTS = 5;

/** A 10-digit Indian mobile number → E.164. */
export const toE164 = (digits: string) => `+91${digits.replace(/\D/g, "").slice(-10)}`;

export async function parentRequestOtp(input: {
  phone: string;
  ip: string | null;
}): Promise<{ devCode?: string }> {
  const phone = toE164(input.phone);
  await limit(db, `otp:${phone}`, 5, HOUR, "Too many codes requested. Try again in an hour.");
  await limit(db, `otp-ip:${input.ip ?? "?"}`, 20, HOUR);

  const guardian = await db.guardian.findFirst({ where: { phone, deletedAt: null } });
  // Same answer either way; only a known number actually gets a code.
  if (!guardian) return {};

  const code = newOtp();
  await db.otpCode.create({
    data: { phone, codeHash: await hashSecret(code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });
  // TODO(sms): hand `code` to the SMS provider here.
  return devEcho() ? { devCode: code } : {};
}

export async function parentVerifyOtp(input: {
  phone: string;
  code: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const phone = toE164(input.phone);
  const wrong = new ApiError("UNAUTHENTICATED", "That code did not match. Check the SMS and try again.");

  const otp = await db.otpCode.findFirst({
    where: { phone, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) throw new ApiError("UNAUTHENTICATED", "That code has expired. Request a new one.");
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    throw new ApiError("RATE_LIMITED", "Too many wrong codes. Request a new one.");
  }
  await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
  if (!(await verifySecret(input.code, otp.codeHash))) throw wrong;

  const guardian = await db.guardian.findFirst({ where: { phone, deletedAt: null } });
  if (!guardian) throw wrong;

  await db.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
  await startSession("parent", guardian, input.userAgent);
  await db.guardian.update({ where: { id: guardian.id }, data: { lastLoginAt: new Date() } });
  await auditDirect({
    schoolId: guardian.schoolId, actorType: "guardian", actorId: guardian.id,
    action: "LOGIN", entityType: "Guardian", entityId: guardian.id, ip: input.ip,
  });
}

// ── Crew: crew ID + PIN, bound to a device ─────────────────────────────────

const CREW_MAX_FAILS = 5;
const CREW_LOCK_MS = 15 * MINUTE;

export async function crewLogin(input: {
  crewId: string;
  pin: string;
  deviceId: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const crewId = input.crewId.trim().toUpperCase();
  const bucket = `crew-login:${input.ip ?? "?"}`;
  await checkLimit(db, bucket, 20, 15 * MINUTE);

  const crew = await db.crew.findFirst({ where: { crewId, deletedAt: null } });
  const ok = await verifySecret(input.pin, crew?.pinHash ?? DUMMY_HASH);
  if (!crew || !ok) await recordHit(db, bucket);
  if (!crew) throw new ApiError("UNAUTHENTICATED", BAD_LOGIN);

  if (crew.lockedUntil && crew.lockedUntil > new Date()) {
    throw new ApiError("RATE_LIMITED", "Too many wrong PINs. Try again in 15 minutes or call the transport office.");
  }
  if (crew.status === "SUSPENDED") {
    throw new ApiError("FORBIDDEN", "This crew ID is suspended. Call the transport office.");
  }

  if (!ok) {
    const fails = crew.failedLogins + 1;
    await db.crew.update({
      where: { id: crew.id },
      data: {
        failedLogins: fails >= CREW_MAX_FAILS ? 0 : fails,
        lockedUntil: fails >= CREW_MAX_FAILS ? new Date(Date.now() + CREW_LOCK_MS) : null,
      },
    });
    await auditDirect({
      schoolId: crew.schoolId, actorType: "crew", actorId: crew.id,
      action: fails >= CREW_MAX_FAILS ? "LOGIN_LOCKED" : "LOGIN_FAILED",
      entityType: "Crew", entityId: crew.id, ip: input.ip,
    });
    throw new ApiError("UNAUTHENTICATED", BAD_LOGIN);
  }

  // A phone swap is allowed but recorded, so the office can spot a shared PIN.
  const deviceChanged = crew.boundDeviceId !== null && crew.boundDeviceId !== input.deviceId;
  await db.crew.update({
    where: { id: crew.id },
    data: { failedLogins: 0, lockedUntil: null, boundDeviceId: input.deviceId, lastLoginAt: new Date() },
  });
  await startSession("crew", crew, input.userAgent);
  await auditDirect({
    schoolId: crew.schoolId, actorType: "crew", actorId: crew.id,
    action: deviceChanged ? "LOGIN_NEW_DEVICE" : "LOGIN",
    entityType: "Crew", entityId: crew.id, ip: input.ip,
    meta: { deviceId: input.deviceId },
  });
}
