import "server-only";
import { z } from "zod";
import { ApiError } from "@/server/http/errors";

/**
 * LivePin — GPS and dashcam vendor (https://docs.livepin.in).
 *
 * Auth: API key + secret are exchanged for a JWT (no refresh token; we log in
 * again before it expires). Every call sends `x-api-key` and the bearer token.
 *
 * Only the v2 vehicle endpoint is used: the legacy `GET /api/vehicles` returns
 * other users' account records (password hashes, emails, push tokens). Every
 * response is parsed down to the fields below and nothing else is kept.
 *
 * Verified against the live API (2026-10):
 *   - dashcam stream is `GET /api/vehicles/:vehicleId/v2/get-dashcam-stream`,
 *     keyed by `vehicle.id`, not the device `id` (the docs' curl uses POST,
 *     which answers 405);
 *   - an offline device answers 400 "Failed to start dashcam stream".
 */

const PLAYER = "https://livepin.in/player_v2.html";
const TOKEN_SECONDS = 3600;
const RENEW_EARLY_MS = 5 * 60_000;
const TIMEOUT_MS = 15_000;

const num = z.coerce.number();
const optNum = z.union([z.number(), z.string()]).nullish().transform((v) => (v == null || v === "" ? null : Number(v)));

const alarmSchema = z.record(z.string(), z.unknown()).nullish().transform((a) => {
  const on: string[] = [];
  for (const [k, v] of Object.entries(a ?? {})) if (v === true) on.push(k);
  return on;
});

const vehicleSchema = z.object({
  id: num,
  imei: z.string(),
  active: z.boolean().nullish(),
  is_dashcam: z.boolean().nullish(),
  dashcam_total_channels: optNum,
  vehicle_status: z.string().nullish(),
  address: z.string().nullish(),
  last_vehicle_status: z.object({ status: z.string().nullish(), timestamp: optNum }).nullish(),
  vehicle: z.object({ id: num, vehicle_no: z.string(), vehicle_type: z.string().nullish(), location_update_interval: z.string().nullish() }),
  location_data: z
    .object({
      latitude: optNum,
      longitude: optNum,
      speed: optNum,
      angle: optNum,
      acc: z.boolean().nullish(),
      timestamp: optNum,
      server_timestamp: optNum,
      alarm: alarmSchema,
    })
    .nullish(),
});

/** One tracker as we use it. Nothing about the vendor's account holders. */
export interface LivePinVehicle {
  deviceId: string;
  vehicleId: string;
  vehicleNo: string;
  imei: string;
  dashcamChannels: number;
  status: string | null;
  updateInterval: string | null;
  address: string | null;
  fix: {
    lat: number;
    lng: number;
    speed: number;
    heading: number | null;
    ignition: boolean | null;
    at: Date;
    receivedAt: Date | null;
    alarms: string[];
  } | null;
}

export function parseFleet(payload: unknown): LivePinVehicle[] {
  const list = Array.isArray(payload) ? payload : (payload as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  const out: LivePinVehicle[] = [];
  for (const raw of list) {
    const r = vehicleSchema.safeParse(raw);
    if (!r.success) continue;
    const v = r.data;
    const ld = v.location_data;
    const hasFix = ld && ld.latitude != null && ld.longitude != null && ld.timestamp != null;
    out.push({
      deviceId: String(v.id),
      vehicleId: String(v.vehicle.id),
      vehicleNo: v.vehicle.vehicle_no.trim(),
      imei: v.imei.trim(),
      dashcamChannels: v.is_dashcam ? (v.dashcam_total_channels ?? 0) : 0,
      status: v.vehicle_status ?? null,
      updateInterval: v.vehicle.location_update_interval ?? null,
      address: v.address ?? null,
      fix: hasFix
        ? {
            lat: ld.latitude!,
            lng: ld.longitude!,
            speed: ld.speed ?? 0,
            heading: ld.angle ?? null,
            ignition: ld.acc ?? null,
            at: new Date(ld.timestamp!),
            receivedAt: ld.server_timestamp != null ? new Date(ld.server_timestamp) : null,
            alarms: ld.alarm,
          }
        : null,
    });
  }
  return out;
}

const historySchema = z.object({
  location_records: z
    .array(
      z.object({
        latitude: optNum,
        longitude: optNum,
        speed: optNum,
        angle: optNum,
        acc: z.boolean().nullish(),
        timestamp: optNum,
      }),
    )
    .default([]),
});

/**
 * Stream URLs come back as an array, an object of channels, or nested in
 * `data`. FLV URLs are preferred; any other http(s) URL is the fallback.
 */
export function parseStreamUrls(payload: unknown): string[] {
  const found: string[] = [];
  const walk = (x: unknown) => {
    if (typeof x === "string") {
      if (/^(https?|wss?):\/\//.test(x)) found.push(x);
    } else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") Object.values(x).forEach(walk);
  };
  walk(payload);
  const unique = [...new Set(found)];
  const flv = unique.filter((u) => /flv/i.test(u));
  return flv.length ? flv : unique;
}

export const playerUrl = (urls: string[]) => `${PLAYER}?urls=${urls.map(encodeURIComponent).join(",")}`;

// ── HTTP ──────────────────────────────────────────────────────────────────

function config() {
  const base = process.env.LIVEPIN_API_BASE_URL || "https://api.livepin.in";
  const key = process.env.LIVEPIN_API_KEY;
  const secret = process.env.LIVEPIN_API_SECRET;
  return { base, key, secret };
}

export const livepinConfigured = () => {
  const { key, secret } = config();
  return !!key && !!secret;
};

const unavailable = (detail?: string) =>
  new ApiError("INTERNAL", detail ? `Tracking provider: ${detail}` : "The tracking provider is unavailable. Try again shortly.");

let token: { jwt: string; expires: number } | null = null;

async function login(): Promise<string> {
  if (token && token.expires - RENEW_EARLY_MS > Date.now()) return token.jwt;
  const { base, key, secret } = config();
  if (!key || !secret) throw new ApiError("CONFLICT", "LivePin is not configured. Set LIVEPIN_API_KEY and LIVEPIN_API_SECRET.");
  const res = await fetch(`${base}/api/user/login-with-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: key, api_secret: secret, expiry: TOKEN_SECONDS }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) throw unavailable(res ? `sign-in refused (${res.status})` : undefined);
  const body = (await res.json().catch(() => null)) as { jwt?: string } | null;
  if (!body?.jwt) throw unavailable("sign-in returned no token");
  token = { jwt: body.jwt, expires: Date.now() + TOKEN_SECONDS * 1000 };
  return token.jwt;
}

async function call(path: string, init: RequestInit = {}, retried = false): Promise<unknown> {
  const { base, key } = config();
  const jwt = await login();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), "x-api-key": key!, authorization: `Bearer ${jwt}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  }).catch(() => null);
  if (!res) throw unavailable();
  if (res.status === 401 && !retried) {
    token = null;
    return call(path, init, true);
  }
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!res.ok) {
    const message = body?.error?.message ?? `request failed (${res.status})`;
    throw new ApiError(res.status >= 500 ? "INTERNAL" : "CONFLICT", `Tracking provider: ${message}`);
  }
  return body;
}

export async function listFleet(): Promise<LivePinVehicle[]> {
  return parseFleet(await call("/api/v2/vehicles"));
}

export async function history(vehicleId: string, from: Date, to: Date) {
  const q = new URLSearchParams({ start_timestamp: String(from.getTime()), end_timestamp: String(to.getTime()) });
  const parsed = historySchema.safeParse(await call(`/api/vehicles/${encodeURIComponent(vehicleId)}/location-history?${q}`));
  if (!parsed.success) return [];
  return parsed.data.location_records
    .filter((p) => p.latitude != null && p.longitude != null && p.timestamp != null)
    .map((p) => ({
      lat: p.latitude!,
      lng: p.longitude!,
      speed: p.speed ?? 0,
      heading: p.angle ?? null,
      ignition: p.acc ?? null,
      at: new Date(p.timestamp!),
    }));
}

/** Starts the dashcam's live stream and returns one URL per channel. */
export async function dashcamStream(vehicleId: string): Promise<string[]> {
  let payload: unknown;
  try {
    payload = await call(`/api/vehicles/${encodeURIComponent(vehicleId)}/v2/get-dashcam-stream`);
  } catch (error) {
    if (error instanceof ApiError && /Failed to start/i.test(error.message)) {
      throw new ApiError("CONFLICT", "The camera is not reachable. The bus may be switched off or out of coverage.");
    }
    throw error;
  }
  const urls = parseStreamUrls(payload);
  if (!urls.length) throw unavailable("no stream returned");
  return urls;
}
