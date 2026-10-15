/**
 * The wire format every API route speaks (docs/handoff/API.md, "Errors").
 * Shared by the server (src/server/http) and the browser client
 * (src/lib/api/client.ts), so both sides agree on codes and shapes.
 */

export const ERROR_STATUS = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  WRONG_APP: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

/** Field path ("stops.2.time") → message, for inline form errors. */
export type FieldErrors = Record<string, string>;

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; fields?: FieldErrors };
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiDataBody<T> {
  data: T;
  meta?: PageMeta;
}

/** The three apps. Each has its own login, cookie and API prefix. */
export type App = "admin" | "parent" | "crew";

export const SESSION_COOKIE: Record<App, string> = {
  admin: "gf_admin",
  parent: "gf_parent",
  crew: "gf_crew",
};
