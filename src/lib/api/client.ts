import type { ApiDataBody, ApiErrorBody, ErrorCode, FieldErrors, PageMeta } from "./envelope";

/**
 * The browser side of the API. Every store calls through here, so error
 * handling and retries behave the same in all three apps.
 */

export class ApiRequestError extends Error {
  constructor(
    readonly code: ErrorCode | "NETWORK",
    message: string,
    readonly status: number,
    readonly fields?: FieldErrors,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }

  /** The request never reached the server; safe to queue and retry. */
  get offline(): boolean {
    return this.code === "NETWORK";
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface Options {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Makes a write safe to retry: the server replays the first response. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

function withQuery(path: string, query: Options["query"]): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function send<T>(method: Method, path: string, options: Options = {}): Promise<ApiDataBody<T>> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.idempotencyKey) headers["idempotency-key"] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(withQuery(path, options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
    });
  } catch {
    throw new ApiRequestError("NETWORK", "You appear to be offline.", 0);
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiDataBody<T>
    | ApiErrorBody
    | null;

  if (!response.ok || !payload || "error" in payload) {
    const err = payload && "error" in payload ? payload.error : null;
    throw new ApiRequestError(
      err?.code ?? "INTERNAL",
      err?.message ?? "Something went wrong. Try again.",
      response.status,
      err?.fields,
    );
  }
  return payload;
}

export const api = {
  get: async <T>(path: string, options?: Options) => (await send<T>("GET", path, options)).data,
  /** A paged list: items plus `meta`. */
  list: async <T>(path: string, options?: Options): Promise<{ items: T[]; meta?: PageMeta }> => {
    const res = await send<T[]>("GET", path, options);
    return { items: res.data, meta: res.meta };
  },
  post: async <T>(path: string, body?: unknown, options?: Omit<Options, "body">) =>
    (await send<T>("POST", path, { ...options, body: body ?? {} })).data,
  patch: async <T>(path: string, body: unknown, options?: Omit<Options, "body">) =>
    (await send<T>("PATCH", path, { ...options, body })).data,
  put: async <T>(path: string, body: unknown, options?: Omit<Options, "body">) =>
    (await send<T>("PUT", path, { ...options, body })).data,
  delete: async <T>(path: string, options?: Omit<Options, "body">) =>
    (await send<T>("DELETE", path, options)).data,
};

/** A message fit for a toast, from anything a request can throw. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return "Something went wrong. Try again.";
}

export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
