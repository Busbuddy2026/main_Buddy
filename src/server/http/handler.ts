import "server-only";
import type { NextRequest } from "next/server";
import type { z, ZodType } from "zod";
import { db, type Tx } from "@/server/db";
import { requireSession, type Session } from "@/server/auth/session";
import { ApiError, toApiError } from "@/server/http/errors";
import type { AdminRole, Prisma } from "@/generated/prisma/client";
import type { ApiDataBody, ApiErrorBody, App, PageMeta } from "@/lib/api/envelope";

/**
 * Every API route goes through `route()` (signed-in apps) or `publicRoute()`
 * (login endpoints). Between them they enforce the non-negotiables in one
 * place, so a handler cannot forget one:
 *
 * - the session matches the app, else 401 / 403 WRONG_APP;
 * - `schoolId` comes from the session, never from the request;
 * - admin roles: VIEWER is read-only, `roles` narrows further;
 * - body and query are Zod-parsed before the handler runs;
 * - every write runs in one transaction and leaves at least one AuditLog row;
 * - an `Idempotency-Key` header makes a write safe to retry.
 */

export interface AuditEntry {
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
}

export interface Actor {
  id: string;
  name: string;
  /** Admins only. */
  role?: AdminRole;
}

export interface Ctx {
  db: Tx;
  app: App;
  session: Session;
  schoolId: string;
  actor: Actor;
  ip: string | null;
  params: Record<string, string>;
  request: NextRequest;
  /** Record an audit row; written in the same transaction as the change. */
  audit(entry: AuditEntry): void;
}

/** Return this from a handler to add pagination `meta` to the envelope. */
export class Page<T> {
  constructor(
    readonly items: T[],
    readonly meta: PageMeta,
  ) {}
}

/** A route with no schema receives the raw JSON and must parse it itself. */
type Infer<S> = S extends ZodType ? z.infer<S> : unknown;

interface RouteOptions<B extends ZodType | undefined, Q extends ZodType | undefined> {
  app: App;
  /**
   * Default true: a write runs in one transaction. False hands the handler the
   * pooled client so it can commit in pieces (the crew sync applies each queued
   * event on its own, so one bad event cannot block the rest). Audit entries
   * are then written after the handler returns; the handler stays responsible
   * for auditing inside its own transactions where atomicity matters.
   */
  atomic?: boolean;
  /** Admin roles allowed. Defaults to everyone signed in (VIEWER: reads only). */
  roles?: AdminRole[];
  body?: B;
  query?: Q;
}

type RouteContext = { params: Promise<Record<string, string | string[]>> };

const ACTOR_TYPE: Record<App, string> = { admin: "admin", parent: "guardian", crew: "crew" };

export function clientIp(request: NextRequest): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

function errorResponse(error: unknown): Response {
  const api = toApiError(error);
  if (api.code === "INTERNAL") {
    // The one place unexpected errors surface; the client gets a generic message.
    console.error(error);
  }
  const body: ApiErrorBody = {
    error: { code: api.code, message: api.message, ...(api.fields ? { fields: api.fields } : {}) },
  };
  return Response.json(body, { status: api.status });
}

function dataResponse(result: unknown, status = 200): Response {
  if (result instanceof Response) return result;
  const body: ApiDataBody<unknown> =
    result instanceof Page ? { data: result.items, meta: result.meta } : { data: result ?? null };
  return Response.json(body, { status });
}

async function readJson(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError("VALIDATION", "Malformed JSON body.");
  }
}

function parse<S extends ZodType | undefined>(schema: S, input: unknown): Infer<S> {
  return (schema ? schema.parse(input) : input) as Infer<S>;
}

/** The signed-in actor, re-checked on every request so a deleted or
 *  suspended account loses access at once, not when its cookie expires. */
async function loadActor(session: Session): Promise<Actor> {
  const gone = new ApiError("UNAUTHENTICATED", "Sign in to continue.");
  if (session.app === "admin") {
    const user = await db.adminUser.findFirst({
      where: { id: session.actorId, schoolId: session.schoolId, deletedAt: null },
      select: { id: true, name: true, role: true },
    });
    if (!user) throw gone;
    return user;
  }
  if (session.app === "parent") {
    const guardian = await db.guardian.findFirst({
      where: { id: session.actorId, schoolId: session.schoolId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!guardian) throw gone;
    return guardian;
  }
  const crew = await db.crew.findFirst({
    where: {
      id: session.actorId,
      schoolId: session.schoolId,
      deletedAt: null,
      status: { not: "SUSPENDED" },
    },
    select: { id: true, name: true },
  });
  if (!crew) throw gone;
  return crew;
}

function flatParams(raw: Record<string, string | string[]>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v.join("/") : v]),
  );
}

export function route<B extends ZodType | undefined = undefined, Q extends ZodType | undefined = undefined>(
  options: RouteOptions<B, Q>,
  handler: (input: { body: Infer<B>; query: Infer<Q>; ctx: Ctx }) => Promise<unknown>,
) {
  return async (request: NextRequest, context: RouteContext): Promise<Response> => {
    try {
      const session = await requireSession(options.app);
      const actor = await loadActor(session);
      const isWrite = request.method !== "GET" && request.method !== "HEAD";

      if (options.app === "admin") {
        if (isWrite && actor.role === "VIEWER") {
          throw new ApiError("FORBIDDEN", "Your role can view but not change records.");
        }
        if (options.roles && actor.role && !options.roles.includes(actor.role)) {
          throw new ApiError("FORBIDDEN", "Your role cannot do this.");
        }
      }

      const params = flatParams((await context?.params) ?? {});
      const query = parse<Q>(options.query as Q, Object.fromEntries(request.nextUrl.searchParams));
      const body = isWrite ? parse<B>(options.body as B, await readJson(request)) : (undefined as Infer<B>);
      const ip = clientIp(request);
      const base = { app: options.app, session, schoolId: session.schoolId, actor, ip, params, request };

      if (!isWrite || options.atomic === false) {
        // Reads may still audit (CCTV views); those rows are written after.
        const entries: AuditEntry[] = [];
        const ctx: Ctx = { ...base, db, audit: (e) => void entries.push(e) };
        const result = await handler({ body, query, ctx });
        if (entries.length) await writeAudit(db, base, entries);
        return dataResponse(result, isWrite && request.method === "POST" ? 201 : 200);
      }

      const idemKey = request.headers.get("idempotency-key")?.slice(0, 120) || null;
      if (idemKey) {
        const seen = await db.idempotencyKey.findUnique({
          where: { schoolId_key: { schoolId: session.schoolId, key: idemKey } },
        });
        if (seen) return Response.json(seen.response, { status: seen.status });
      }

      const status = request.method === "POST" ? 201 : 200;
      const result = await db.$transaction(
        async (tx) => {
          const entries: AuditEntry[] = [];
          const ctx: Ctx = { ...base, db: tx, audit: (e) => void entries.push(e) };
          const out = await handler({ body, query, ctx });
          // Non-negotiable 5: no write leaves without an audit row.
          if (!entries.length) {
            entries.push({ action: `${request.method} ${request.nextUrl.pathname}` });
          }
          await writeAudit(tx, base, entries);
          if (idemKey && !(out instanceof Response)) {
            await tx.idempotencyKey.create({
              data: {
                schoolId: session.schoolId,
                key: idemKey,
                route: request.nextUrl.pathname,
                status,
                response: JSON.parse(JSON.stringify({ data: out ?? null })) as Prisma.InputJsonValue,
              },
            });
          }
          return out;
        },
        { timeout: 15_000, maxWait: 10_000 },
      );
      return dataResponse(result, status);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function writeAudit(
  client: Tx,
  base: { app: App; schoolId: string; actor: Actor; ip: string | null },
  entries: AuditEntry[],
): Promise<void> {
  await client.auditLog.createMany({
    data: entries.map((e) => ({
      schoolId: base.schoolId,
      actorType: ACTOR_TYPE[base.app],
      actorId: base.actor.id,
      action: e.action,
      entityType: e.entityType ?? null,
      entityId: e.entityId ?? null,
      meta: e.meta,
      ip: base.ip,
    })),
  });
}

/** Write one audit row outside a route transaction (logins, failed logins). */
export async function auditDirect(entry: AuditEntry & {
  schoolId: string;
  actorType: string;
  actorId?: string | null;
  ip?: string | null;
}): Promise<void> {
  await db.auditLog.create({
    data: {
      schoolId: entry.schoolId,
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      meta: entry.meta,
      ip: entry.ip ?? null,
    },
  });
}

/**
 * Unauthenticated endpoints (sign-in, OTP). No transaction: rate-limit hits
 * and failed-login audit rows must persist even when the request is refused.
 */
export function publicRoute<B extends ZodType | undefined = undefined>(
  options: { body?: B },
  handler: (input: { body: Infer<B>; request: NextRequest; ip: string | null }) => Promise<unknown>,
) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      const body = parse<B>(options.body as B, await readJson(request));
      return dataResponse(await handler({ body, request, ip: clientIp(request) }));
    } catch (error) {
      return errorResponse(error);
    }
  };
}
