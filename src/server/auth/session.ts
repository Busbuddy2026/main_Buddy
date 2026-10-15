import "server-only";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { ApiError } from "@/server/http/errors";
import { newToken, sha256 } from "@/server/auth/crypto";
import { SESSION_COOKIE, type App } from "@/lib/api/envelope";
import type { AppKind } from "@/generated/prisma/client";

/**
 * Server-side sessions, one cookie per app (non-negotiable 1).
 *
 * The cookie holds a random token; the database holds only its hash, so
 * logout and revocation are real and a leaked table leaks no sessions.
 * No `Domain` attribute is set, which makes each cookie host-only: on
 * admin.<domain> the browser never sends it to parents.<domain>.
 */

const KIND: Record<App, AppKind> = { admin: "ADMIN", parent: "PARENT", crew: "CREW" };

const DAY = 86_400_000;

/** Parents stay signed in like any consumer app; staff sessions are shorter. */
const TTL_MS: Record<App, number> = {
  admin: 12 * 60 * 60 * 1000,
  parent: 90 * DAY,
  // Long enough to survive a day offline on the bus.
  crew: 7 * DAY,
};

/** Refresh lastSeenAt at most this often, so reads stay reads. */
const TOUCH_EVERY_MS = 5 * 60 * 1000;

export interface Session {
  id: string;
  app: App;
  actorId: string;
  schoolId: string;
}

export async function startSession(
  app: App,
  actor: { id: string; schoolId: string },
  userAgent: string | null,
): Promise<void> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + TTL_MS[app]);
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      app: KIND[app],
      actorId: actor.id,
      schoolId: actor.schoolId,
      expiresAt,
      userAgent: userAgent?.slice(0, 300) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE[app], token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Revoke the current app's session and clear its cookie. */
export async function endSession(app: App): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE[app])?.value;
  jar.delete(SESSION_COOKIE[app]);
  if (!token) return null;
  const row = await db.session.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.revokedAt) return null;
  await db.session.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  return { id: row.id, app, actorId: row.actorId, schoolId: row.schoolId };
}

/** Revoke every session an actor holds, e.g. after a password reset. */
export async function revokeAllFor(actorId: string): Promise<void> {
  await db.session.updateMany({
    where: { actorId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * The session for `app`, or null. A cookie that is present but expired,
 * revoked or forged counts as absent.
 */
export async function readSession(app: App): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE[app])?.value;
  if (!token) return null;
  const row = await db.session.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.app !== KIND[app] || row.revokedAt || row.expiresAt <= new Date()) {
    return null;
  }
  if (Date.now() - row.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await db.session.update({ where: { id: row.id }, data: { lastSeenAt: new Date() } });
  }
  return { id: row.id, app, actorId: row.actorId, schoolId: row.schoolId };
}

/**
 * The session for `app`, or the right error. Arriving with another app's
 * cookie and none of this one's is WRONG_APP (403), not a login prompt:
 * a parent token must never be treated as "maybe an admin".
 */
export async function requireSession(app: App): Promise<Session> {
  const session = await readSession(app);
  if (session) return session;
  const jar = await cookies();
  const others = (Object.keys(SESSION_COOKIE) as App[]).filter((a) => a !== app);
  if (others.some((a) => jar.has(SESSION_COOKIE[a])) && !jar.has(SESSION_COOKIE[app])) {
    throw new ApiError("WRONG_APP", "This session belongs to a different app.");
  }
  throw new ApiError("UNAUTHENTICATED", "Sign in to continue.");
}
