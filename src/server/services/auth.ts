import "server-only";
import { db } from "@/server/db";
import { timingSafeEqual } from "node:crypto";
import { DUMMY_HASH, verifySecret } from "@/server/auth/crypto";
import { MINUTE, checkLimit, recordHit } from "@/server/auth/rate-limit";
import { startSession } from "@/server/auth/session";
import { auditDirect } from "@/server/http/handler";
import { ApiError } from "@/server/http/errors";

/**
 * Sign-in for the three apps. Every refusal reads the same whether or not the
 * account exists (API.md: never reveal whether a phone or username exists), and
 * every attempt is rate limited in the database.
 */

const BAD_LOGIN = "Those details did not match.";

// ── Admin: username + password ─────────────────────────────────────────────

export async function adminLogin(input: {
  username: string;
  password: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const username = input.username.trim().toLowerCase();
  // Failed attempts only: signing in and out all day must not lock anyone out.
  const bucket = `admin-login:${input.ip ?? "?"}:${username}`;
  await checkLimit(db, bucket, 5, 15 * MINUTE);

  const user = await db.adminUser.findFirst({ where: { username, deletedAt: null } });
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

// ── Parent: phone + the school's parent password ───────────────────────────

/**
 * Every parent signs in with their registered mobile number and one password
 * the school shares with parents. A school may keep its own, hashed, under
 * `parentPasswordHash` in its settings; until then the default applies.
 */
const DEFAULT_PARENT_PASSWORD = "Parent@2026";
const PARENT_PASSWORD_KEY = "parentPasswordHash";

/** A 10-digit Indian mobile number → E.164. */
export const toE164 = (digits: string) => `+91${digits.replace(/\D/g, "").slice(-10)}`;

async function parentPasswordMatches(schoolId: string, password: string): Promise<boolean> {
  const school = await db.school.findUnique({ where: { id: schoolId }, select: { settings: true } });
  const stored = ((school?.settings ?? {}) as Record<string, unknown>)[PARENT_PASSWORD_KEY];
  if (typeof stored === "string") return verifySecret(password, stored);
  const want = Buffer.from(DEFAULT_PARENT_PASSWORD);
  const got = Buffer.from(password);
  return want.length === got.length && timingSafeEqual(want, got);
}

export async function parentLogin(input: {
  phone: string;
  password: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const phone = toE164(input.phone);
  // Failed attempts only, per number and per network.
  const byPhone = `parent-login:${phone}`;
  const byIp = `parent-login-ip:${input.ip ?? "?"}`;
  await checkLimit(db, byPhone, 5, 15 * MINUTE);
  await checkLimit(db, byIp, 30, 15 * MINUTE);

  const guardian = await db.guardian.findFirst({ where: { phone, deletedAt: null }, orderBy: { createdAt: "asc" } });
  const ok = guardian ? await parentPasswordMatches(guardian.schoolId, input.password) : (await verifySecret(input.password, DUMMY_HASH), false);

  if (!guardian || !ok) {
    await recordHit(db, byPhone);
    await recordHit(db, byIp);
    if (guardian) {
      await auditDirect({
        schoolId: guardian.schoolId, actorType: "guardian", actorId: guardian.id,
        action: "LOGIN_FAILED", entityType: "Guardian", entityId: guardian.id, ip: input.ip,
      });
    }
    throw new ApiError("UNAUTHENTICATED", "That number and password did not match. Use the number registered with the school.");
  }

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
