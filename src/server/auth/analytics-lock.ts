import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import type { Ctx } from "@/server/http/handler";
import { ApiError, invalid } from "@/server/http/errors";
import { hashSecret, verifySecret } from "@/server/auth/crypto";
import { MINUTE, checkLimit, recordHit } from "@/server/auth/rate-limit";
import { SESSION_COOKIE } from "@/lib/api/envelope";

/**
 * The PIN in front of Analytics. Unlocking sets a cookie good for 30 minutes,
 * signed with the admin's own session token, so it is worthless in any other
 * session and dies with the sign-in. Every analytics API checks it, not just
 * the screens. The PIN is kept hashed in the school's settings; until a super
 * admin changes it, the default applies.
 */

const COOKIE = "gf_analytics";
const UNLOCK_MS = 30 * 60_000;
const DEFAULT_PIN = "671993";
const PIN_KEY = "analyticsPinHash";

const sign = (sessionToken: string, exp: number) => createHmac("sha256", sessionToken).update(`analytics:${exp}`).digest("base64url");

/** Is Analytics unlocked for this admin's current sign-in? */
export async function analyticsUnlocked(): Promise<boolean> {
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE.admin)?.value;
  const value = jar.get(COOKIE)?.value;
  if (!session || !value) return false;
  const [expRaw, sig] = value.split(".");
  const exp = Number(expRaw);
  if (!sig || !Number.isFinite(exp) || exp <= Date.now()) return false;
  const want = Buffer.from(sign(session, exp));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** For analytics API routes: refuse unless unlocked. */
export async function requireAnalytics(): Promise<void> {
  if (!(await analyticsUnlocked())) throw new ApiError("FORBIDDEN", "Analytics is locked. Enter the analytics PIN.");
}

async function storedPinHash(ctx: Ctx): Promise<string | null> {
  const school = await ctx.db.school.findUniqueOrThrow({ where: { id: ctx.schoolId }, select: { settings: true } });
  const raw = (school.settings ?? {}) as Record<string, unknown>;
  return typeof raw[PIN_KEY] === "string" ? (raw[PIN_KEY] as string) : null;
}

async function pinMatches(ctx: Ctx, pin: string): Promise<boolean> {
  const hash = await storedPinHash(ctx);
  if (!hash) return pin.length === DEFAULT_PIN.length && timingSafeEqual(Buffer.from(pin), Buffer.from(DEFAULT_PIN));
  return verifySecret(pin, hash);
}

export const pinSchema = z.object({ pin: z.string().regex(/^\d{4,8}$/, "Enter the PIN.") });

export async function unlockAnalytics(ctx: Ctx, input: z.infer<typeof pinSchema>) {
  const bucket = `analytics-pin:${ctx.actor.id}`;
  await checkLimit(ctx.db, bucket, 5, 15 * MINUTE);
  if (!(await pinMatches(ctx, input.pin))) {
    await recordHit(ctx.db, bucket);
    ctx.audit({ action: "ANALYTICS_PIN_FAILED" });
    throw invalid("That PIN is not right.", { pin: "Wrong PIN." });
  }
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE.admin)?.value;
  if (!session) throw new ApiError("UNAUTHENTICATED", "Sign in to continue.");
  const exp = Date.now() + UNLOCK_MS;
  jar.set(COOKIE, `${exp}.${sign(session, exp)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UNLOCK_MS / 1000,
  });
  ctx.audit({ action: "ANALYTICS_UNLOCKED" });
  return { ok: true, until: new Date(exp).toISOString() };
}

export async function lockAnalytics(ctx: Ctx) {
  (await cookies()).delete(COOKIE);
  ctx.audit({ action: "ANALYTICS_LOCKED" });
  return { ok: true };
}

export const changePinSchema = z.object({
  current: z.string().regex(/^\d{4,8}$/, "Enter the current PIN."),
  next: z.string().regex(/^\d{6}$/, "Use exactly 6 digits."),
});

/** Super admins: set a new PIN (the current one first). Kept hashed. */
export async function changeAnalyticsPin(ctx: Ctx, input: z.infer<typeof changePinSchema>) {
  const bucket = `analytics-pin:${ctx.actor.id}`;
  await checkLimit(ctx.db, bucket, 5, 15 * MINUTE);
  if (!(await pinMatches(ctx, input.current))) {
    await recordHit(ctx.db, bucket);
    throw invalid("The current PIN is not right.", { current: "Wrong PIN." });
  }
  const school = await ctx.db.school.findUniqueOrThrow({ where: { id: ctx.schoolId }, select: { settings: true } });
  const raw = (school.settings ?? {}) as Record<string, unknown>;
  await ctx.db.school.update({ where: { id: ctx.schoolId }, data: { settings: { ...raw, [PIN_KEY]: await hashSecret(input.next) } } });
  ctx.audit({ action: "ANALYTICS_PIN_CHANGED", entityType: "School", entityId: ctx.schoolId });
  return { ok: true };
}
