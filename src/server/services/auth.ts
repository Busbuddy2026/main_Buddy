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
 * Parents and crew each sign in with their own identifier (mobile number,
 * crew ID) and one password the school shares with that group. A school may
 * keep its own, hashed, in its settings; until then the default applies.
 */
const SHARED_PASSWORD = {
  parent: { key: "parentPasswordHash", fallback: "Parent@2026" },
  crew: { key: "crewPasswordHash", fallback: "Crew@2026" },
} as const;

/** A 10-digit Indian mobile number → E.164. */
export const toE164 = (digits: string) => `+91${digits.replace(/\D/g, "").slice(-10)}`;

async function sharedPasswordMatches(group: keyof typeof SHARED_PASSWORD, schoolId: string, password: string): Promise<boolean> {
  const { key, fallback } = SHARED_PASSWORD[group];
  const school = await db.school.findUnique({ where: { id: schoolId }, select: { settings: true } });
  const stored = ((school?.settings ?? {}) as Record<string, unknown>)[key];
  if (typeof stored === "string") return verifySecret(password, stored);
  const want = Buffer.from(fallback);
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
  const ok = guardian ? await sharedPasswordMatches("parent", guardian.schoolId, input.password) : (await verifySecret(input.password, DUMMY_HASH), false);

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

// ── Crew: crew ID + the school's crew password, bound to a device ─────────

const CREW_MAX_FAILS = 5;
const CREW_LOCK_MS = 15 * MINUTE;

/**
 * BMVA5965 signs in as Bus 5965's attendant, BMVD5965 as its driver. A
 * personal ID (GF-ATT-0142, typed loosely) still works.
 */
async function crewForLogin(typed: string) {
  const id = typed.trim().toUpperCase().replace(/[\s_-]+/g, "");
  const personal = /^GF(ATT|DRV)(\d{4})$/.exec(id);
  if (personal) return { crew: await db.crew.findFirst({ where: { crewId: `GF-${personal[1]}-${personal[2]}`, deletedAt: null } }), bus: null, role: null, number: null };
  // BMV, or BVM (the school's initials, an easy swap), then A or D and the bus number.
  const byBus = /^(?:BMV|BVM)([AD])(\w+)$/.exec(id);
  if (!byBus) return { crew: null, bus: null, role: null, number: null };
  const number = byBus[2]!;
  // The bus number as entered in Buses, or the last digits of its registration (TN76BB5965).
  const buses = await db.bus.findMany({
    where: { deletedAt: null, OR: [{ number: { equals: number, mode: "insensitive" } }, { registration: { endsWith: number, mode: "insensitive" } }] },
    include: { attendant: true, driver: true },
    take: 5,
  });
  const bus: (typeof buses)[number] | null = buses.find((b) => b.number.toUpperCase() === number) ?? buses.at(0) ?? null;
  const role = byBus[1] === "A" ? ("attendant" as const) : ("driver" as const);
  const crew = role === "attendant" ? bus?.attendant : bus?.driver;
  return { crew: crew && !crew.deletedAt ? crew : null, bus, role, number };
}

export async function crewLogin(input: {
  crewId: string;
  password: string;
  deviceId: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const bucket = `crew-login:${input.ip ?? "?"}`;
  await checkLimit(db, bucket, 20, 15 * MINUTE);
  const found = await crewForLogin(input.crewId);
  const crew = found.crew;
  const schoolId = crew?.schoolId ?? found.bus?.schoolId;
  const ok = schoolId ? await sharedPasswordMatches("crew", schoolId, input.password) : (await verifySecret(input.password, DUMMY_HASH), false);
  if (!crew || !ok) await recordHit(db, bucket);
  // With the right password, say why the ID did not work.
  if (!crew && ok && found.bus && found.role) {
    throw new ApiError("UNAUTHENTICATED", `Bus ${found.bus.number} has no ${found.role} assigned yet. Ask the transport office to assign one in People → ${found.role === "attendant" ? "Attendants" : "Drivers"}.`);
  }
  // Bus numbers are painted on the buses, so saying none matches gives nothing away.
  if (!crew && found.number && !found.bus) throw new ApiError("UNAUTHENTICATED", `No bus has the number ${found.number}. Check the number on your bus.`);
  if (!crew) throw new ApiError("UNAUTHENTICATED", "That crew ID or password did not match. Crew IDs look like BMVA5965 (attendant) or BMVD5965 (driver).");

  if (crew.lockedUntil && crew.lockedUntil > new Date()) {
    throw new ApiError("RATE_LIMITED", "Too many wrong passwords. Try again in 15 minutes or call the transport office.");
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
    throw new ApiError("UNAUTHENTICATED", "That password did not match. Use the crew password from the transport office.");
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
