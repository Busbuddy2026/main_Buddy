import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { ApiError } from "@/server/http/errors";
import { open, seal } from "@/server/crypto/secret-box";
import type { DayReport } from "@/lib/api/types";

export type { DayReport };

/**
 * LivePin — GPS and dashcam vendor (https://docs.livepin.in).
 *
 * Credentials live per school in `TrackingAccount` (secret encrypted). Each
 * account signs in with its API key + secret for a JWT, cached and renewed
 * before expiry; every call sends `x-api-key` and the bearer token.
 *
 * Every response is parsed down to the fields we show. The legacy
 * `GET /api/vehicles` is never called (it returns other users' account
 * records), and `/location`'s `device_data`, `vehicle_data` and
 * `driver_data` blocks are dropped for the same reason.
 *
 * Verified against the live API (2026-10): the dashcam stream is
 * `GET /api/vehicles/:vehicleId/v2/get-dashcam-stream`, keyed by `vehicle.id`
 * (the docs' POST answers 405); an offline device answers 400.
 */

const PLAYER = "https://livepin.in/player_v2.html";
const PROVIDER = "LIVEPIN";
const TOKEN_SECONDS = 3600;
const RENEW_EARLY_MS = 5 * 60_000;
const TIMEOUT_MS = 20_000;

// ── Parsing ───────────────────────────────────────────────────────────────

const num = z.coerce.number();
const optNum = z.union([z.number(), z.string()]).nullish().transform((v) => (v == null || v === "" ? null : Number(v)));
const optStr = z.string().nullish().transform((v) => v?.trim() || null);
const latLng = z.object({ latitude: optNum, longitude: optNum }).nullish();

/** Alarm/status flag maps → the names that are true. */
const onFlags = z.record(z.string(), z.unknown()).nullish().transform((a) => {
  const on: string[] = [];
  for (const [k, v] of Object.entries(a ?? {})) if (v === true) on.push(k);
  return on;
});

/** Every alarm flag the device reported, on or off. */
const allFlags = z.record(z.string(), z.unknown()).nullish().transform((a) => {
  const flags: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(a ?? {})) if (typeof v === "boolean") flags[k] = v;
  return flags;
});

const vehicleSchema = z.object({
  id: num,
  imei: z.string(),
  is_dashcam: z.boolean().nullish(),
  dashcam_total_channels: optNum,
  expiry: optStr,
  vehicle_status: z.string().nullish(),
  address: z.string().nullish(),
  battery_percent: optNum,
  gps_model: z.object({ model_name: optStr, company: optStr }).nullish(),
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
      alarm: onFlags,
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
  model: string | null;
  vehicleType: string | null;
  subscriptionExpiry: string | null;
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
      model: [v.gps_model?.company, v.gps_model?.model_name].filter(Boolean).join(" ") || null,
      vehicleType: v.vehicle.vehicle_type ?? null,
      subscriptionExpiry: v.expiry,
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

const locationSchema = z.object({
  latitude: optNum,
  longitude: optNum,
  altitude: optNum,
  speed: optNum,
  angle: optNum,
  acc: z.boolean().nullish(),
  timestamp: optNum,
  server_timestamp: optNum,
  vehicle_status: optStr,
  address: optStr,
  battery_percent: optNum,
  alarm: allFlags,
  last_vehicle_status: z.object({ status: optStr, timestamp: optNum }).nullish(),
  status: z
    .object({
      positioning: z.boolean().nullish(),
      running: z.boolean().nullish(),
      load: optStr,
      oil_line_connected: z.boolean().nullish(),
      circuit_connected: z.boolean().nullish(),
      door_locked: z.boolean().nullish(),
      front_door_closed: z.boolean().nullish(),
      middle_door_closed: z.boolean().nullish(),
      back_door_closed: z.boolean().nullish(),
      driver_door_closed: z.boolean().nullish(),
      other_door_closed: z.boolean().nullish(),
      positioning_with_gps: z.boolean().nullish(),
      positioning_with_beidou: z.boolean().nullish(),
      positioning_with_glonass: z.boolean().nullish(),
      positioning_with_galileo: z.boolean().nullish(),
    })
    .nullish(),
});

export interface LivePinLocation {
  lat: number | null;
  lng: number | null;
  altitude: number | null;
  speed: number;
  heading: number | null;
  ignition: boolean | null;
  at: Date | null;
  receivedAt: Date | null;
  status: string | null;
  statusSince: Date | null;
  address: string | null;
  batteryPercent: number | null;
  alarms: string[];
  /** Every alarm flag the device reported, on or off. */
  alarmFlags: Record<string, boolean>;
  sensors: {
    gpsLock: boolean | null;
    running: boolean | null;
    load: string | null;
    fuelLineConnected: boolean | null;
    circuitConnected: boolean | null;
    doorLocked: boolean | null;
    doors: Record<"front" | "middle" | "back" | "driver" | "other", boolean | null>;
    constellations: string[];
  };
}

export function parseLocation(payload: unknown): LivePinLocation | null {
  const r = locationSchema.safeParse(payload);
  if (!r.success) return null;
  const l = r.data;
  const s = l.status;
  return {
    lat: l.latitude,
    lng: l.longitude,
    altitude: l.altitude,
    speed: l.speed ?? 0,
    heading: l.angle,
    ignition: l.acc ?? null,
    at: l.timestamp != null ? new Date(l.timestamp) : null,
    receivedAt: l.server_timestamp != null ? new Date(l.server_timestamp) : null,
    status: l.vehicle_status,
    statusSince: l.last_vehicle_status?.timestamp != null ? new Date(l.last_vehicle_status.timestamp) : null,
    address: l.address,
    batteryPercent: l.battery_percent,
    alarms: Object.entries(l.alarm).filter(([, on]) => on).map(([k]) => k),
    alarmFlags: l.alarm,
    sensors: {
      gpsLock: s?.positioning ?? null,
      running: s?.running ?? null,
      load: s?.load ?? null,
      fuelLineConnected: s?.oil_line_connected ?? null,
      circuitConnected: s?.circuit_connected ?? null,
      doorLocked: s?.door_locked ?? null,
      doors: {
        front: s?.front_door_closed == null ? null : !s.front_door_closed,
        middle: s?.middle_door_closed == null ? null : !s.middle_door_closed,
        back: s?.back_door_closed == null ? null : !s.back_door_closed,
        driver: s?.driver_door_closed == null ? null : !s.driver_door_closed,
        other: s?.other_door_closed == null ? null : !s.other_door_closed,
      },
      constellations: [
        s?.positioning_with_gps ? "GPS" : null,
        s?.positioning_with_beidou ? "BeiDou" : null,
        s?.positioning_with_glonass ? "GLONASS" : null,
        s?.positioning_with_galileo ? "Galileo" : null,
      ].filter((x): x is string => !!x),
    },
  };
}

const eventSchema = z.object({
  start_time: optNum,
  end_time: optNum,
  timestamp: optNum,
  duration: optNum,
  event_type: optStr,
  ignitionStatus: optStr,
  address: optStr,
  location: latLng,
  geofence: z.unknown().nullish(),
  fence_name: optStr,
  fence_id: optNum,
  speed: optNum,
  max_speed: optNum,
});

const dayReportSchema = z.object({
  report: z.object({
    running_distance: optNum,
    moving_duration: optNum,
    engine_on_duration: optNum,
    stopped_duration: optNum,
    idle_duration: optNum,
    parked_duration: optNum,
    over_speed_distance: optNum,
    over_speed_limit: optNum,
    max_speed: optNum,
    avg_speed: optNum,
    fuel_consumed: optNum,
    fuel_filled: optNum,
    stops: z.array(eventSchema).default([]),
    playback: z.array(eventSchema).default([]),
    ignition_events: z.array(eventSchema).default([]),
    overspeed_events: z.array(eventSchema).default([]),
    geofence_events: z.array(eventSchema).default([]),
  }),
});

const ms = (v: number | null | undefined) => (v == null ? null : new Date(v).toISOString());
const pos = (l: z.infer<typeof latLng>) => (l && l.latitude != null && l.longitude != null ? { lat: l.latitude, lng: l.longitude } : null);

export function parseDayReport(payload: unknown): DayReport | null {
  const r = dayReportSchema.safeParse(payload);
  if (!r.success) return null;
  const x = r.data.report;
  return {
    distanceKm: Math.round(((x.running_distance ?? 0) / 1000) * 10) / 10,
    moving: x.moving_duration ?? 0,
    engineOn: x.engine_on_duration ?? 0,
    idle: x.idle_duration ?? 0,
    stopped: x.stopped_duration ?? 0,
    parked: x.parked_duration ?? 0,
    maxSpeed: Math.round(x.max_speed ?? 0),
    avgSpeed: Math.round(x.avg_speed ?? 0),
    overspeedKm: Math.round(((x.over_speed_distance ?? 0) / 1000) * 10) / 10,
    overspeedLimit: x.over_speed_limit,
    fuelUsed: x.fuel_consumed ?? 0,
    fuelFilled: x.fuel_filled ?? 0,
    stops: x.stops.map((s) => ({
      start: ms(s.start_time),
      end: ms(s.end_time),
      address: s.address,
      at: pos(s.location),
      geofence: typeof s.geofence === "string" ? s.geofence : s.fence_name,
    })),
    timeline: x.playback.map((p) => ({
      type: p.event_type ?? "STOP",
      start: ms(p.start_time ?? p.timestamp),
      end: ms(p.end_time),
      durationS: Math.round(p.duration ?? 0),
      address: p.address,
    })),
    ignition: x.ignition_events.map((e) => ({ state: e.ignitionStatus ?? "—", start: ms(e.start_time), end: ms(e.end_time), address: e.address })),
    overspeed: x.overspeed_events.map((e) => ({ start: ms(e.start_time ?? e.timestamp), end: ms(e.end_time), maxSpeed: e.max_speed ?? e.speed, address: e.address })),
    geofence: x.geofence_events.map((g) => ({ event: g.event_type ?? "—", at: ms(g.timestamp), fence: g.fence_name })),
  };
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
        satellites: optNum,
        gsm_signal_strength: optNum,
        external_voltage: optNum,
        battery_voltage: optNum,
        gnss_status: z.union([z.string(), z.number(), z.boolean()]).nullish(),
        active_gsm_operator: z.union([z.string(), z.number()]).nullish(),
      }),
    )
    .default([]),
});

export interface TrackPoint {
  lat: number;
  lng: number;
  speed: number;
  heading: number | null;
  ignition: boolean | null;
  at: Date;
}

export interface DeviceHealth {
  satellites: number | null;
  gsmSignal: number | null;
  externalVoltage: number | null;
  batteryVoltage: number | null;
  gnssStatus: string | null;
  gsmOperator: string | null;
  at: Date | null;
}

export function parseHistory(payload: unknown): { points: TrackPoint[]; health: DeviceHealth } {
  const r = historySchema.safeParse(payload);
  const rows = r.success ? r.data.location_records : [];
  const points = rows
    .filter((p) => p.latitude != null && p.longitude != null && p.timestamp != null)
    .map((p) => ({ lat: p.latitude!, lng: p.longitude!, speed: p.speed ?? 0, heading: p.angle ?? null, ignition: p.acc ?? null, at: new Date(p.timestamp!) }))
    .sort((a, b) => +a.at - +b.at);
  // The latest record that reported each health reading.
  const latest = [...rows].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  const pick = <K extends keyof (typeof rows)[number]>(k: K) => latest.find((x) => x[k] != null)?.[k] ?? null;
  return {
    points,
    health: {
      satellites: pick("satellites") as number | null,
      gsmSignal: pick("gsm_signal_strength") as number | null,
      externalVoltage: pick("external_voltage") as number | null,
      batteryVoltage: pick("battery_voltage") as number | null,
      gnssStatus: pick("gnss_status") == null ? null : String(pick("gnss_status")),
      gsmOperator: pick("active_gsm_operator") == null ? null : String(pick("active_gsm_operator")),
      at: latest[0]?.timestamp ? new Date(latest[0].timestamp) : null,
    },
  };
}

const alertSchema = z.object({
  _id: z.string(),
  title: z.string(),
  description: optStr,
  notification_type: z.string(),
  timestamp: optNum,
  server_timestamp: optNum,
  priorityLevel: optStr,
  location: latLng,
});

export interface LivePinAlert {
  externalId: string;
  type: string;
  title: string;
  description: string | null;
  priority: string | null;
  at: Date;
  lat: number | null;
  lng: number | null;
}

export function parseAlerts(payload: unknown): LivePinAlert[] {
  const list = Array.isArray(payload) ? payload : (payload as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  const out: LivePinAlert[] = [];
  for (const raw of list) {
    const r = alertSchema.safeParse(raw);
    if (!r.success) continue;
    const a = r.data;
    const at = a.timestamp ?? a.server_timestamp;
    if (at == null) continue;
    out.push({
      externalId: `livepin:${a._id}`,
      type: a.notification_type,
      title: a.title,
      description: a.description,
      priority: a.priorityLevel,
      at: new Date(at),
      lat: a.location?.latitude ?? null,
      lng: a.location?.longitude ?? null,
    });
  }
  return out;
}

export const preferencesSchema = z.object({
  overspeed: z.boolean(),
  overspeed_limit: z.number().int().min(20).max(120),
  engine_on: z.boolean(),
  geofence_events: z.boolean(),
  safe_parking: z.boolean(),
  renewal: z.boolean(),
});
export type TrackerPreferences = z.infer<typeof preferencesSchema>;

export const INTERVALS = ["SECOND_10", "MINUTE_1", "MINUTE_5", "MINUTE_10", "MINUTE_15", "MINUTE_30", "HOUR_1", "HOUR_3"] as const;
export type TrackerInterval = (typeof INTERVALS)[number];

/** Stream URLs come back as an array, an object of channels, or nested in `data`. FLV preferred. */
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

/** "YYYY-MM-DD" → LivePin's "D/M/YYYY". */
const vendorDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return `${d}/${m}/${y}`;
};

// ── Accounts ──────────────────────────────────────────────────────────────

interface Account {
  id: string;
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

/** The school's LivePin account. The env credentials seed it once (the trial). */
async function account(schoolId: string): Promise<Account | null> {
  let row = await db.trackingAccount.findUnique({ where: { schoolId_provider: { schoolId, provider: PROVIDER } } });
  if (!row) {
    const key = process.env.LIVEPIN_API_KEY;
    const secret = process.env.LIVEPIN_API_SECRET;
    if (!key || !secret || !process.env.TRACKING_ENC_KEY) return null;
    row = await db.trackingAccount.upsert({
      where: { schoolId_provider: { schoolId, provider: PROVIDER } },
      create: { schoolId, provider: PROVIDER, baseUrl: process.env.LIVEPIN_API_BASE_URL || "https://api.livepin.in", apiKey: key, apiSecretEnc: seal(secret) },
      update: {},
    });
  }
  if (!row.active) return null;
  return { id: row.id, baseUrl: row.baseUrl, apiKey: row.apiKey, apiSecret: open(row.apiSecretEnc) };
}

export async function accountConfigured(schoolId: string): Promise<boolean> {
  return (await account(schoolId).catch(() => null)) !== null;
}

/** Save (or replace) a school's credentials after checking they sign in. */
export async function saveAccount(schoolId: string, input: { apiKey: string; apiSecret: string; baseUrl?: string }) {
  const baseUrl = input.baseUrl || "https://api.livepin.in";
  await signIn({ id: "probe", baseUrl, apiKey: input.apiKey, apiSecret: input.apiSecret }, true);
  const row = await db.trackingAccount.upsert({
    where: { schoolId_provider: { schoolId, provider: PROVIDER } },
    create: { schoolId, provider: PROVIDER, baseUrl, apiKey: input.apiKey, apiSecretEnc: seal(input.apiSecret), lastCheckedAt: new Date() },
    update: { baseUrl, apiKey: input.apiKey, apiSecretEnc: seal(input.apiSecret), active: true, lastCheckedAt: new Date(), lastError: null },
  });
  tokens.delete(row.id);
  return row;
}

export async function accountSummary(schoolId: string) {
  await account(schoolId).catch(() => null); // seeds from env the first time
  const fresh = await db.trackingAccount.findUnique({ where: { schoolId_provider: { schoolId, provider: PROVIDER } } });
  if (!fresh) return null;
  const secret = (() => {
    try {
      return open(fresh.apiSecretEnc);
    } catch {
      return "";
    }
  })();
  return {
    provider: fresh.provider,
    baseUrl: fresh.baseUrl,
    apiKey: `${fresh.apiKey.slice(0, 4)}••••${fresh.apiKey.slice(-3)}`,
    apiSecret: secret ? `••••${secret.slice(-4)}` : "unreadable",
    active: fresh.active,
    lastCheckedAt: fresh.lastCheckedAt?.toISOString() ?? null,
    lastError: fresh.lastError,
    /** Pushes from LivePin are accepted only when this secret is set on the server. */
    webhookConfigured: !!process.env.LIVEPIN_WEBHOOK_SECRET,
  };
}

// ── HTTP ──────────────────────────────────────────────────────────────────

const unavailable = (detail?: string) =>
  new ApiError("INTERNAL", detail ? `Tracking provider: ${detail}` : "The tracking provider is unavailable. Try again shortly.");

const tokens = new Map<string, { jwt: string; expires: number }>();

async function signIn(acc: Account, force = false): Promise<string> {
  const cached = tokens.get(acc.id);
  if (!force && cached && cached.expires - RENEW_EARLY_MS > Date.now()) return cached.jwt;
  const res = await fetch(`${acc.baseUrl}/api/user/login-with-api-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: acc.apiKey, api_secret: acc.apiSecret, expiry: TOKEN_SECONDS }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  }).catch(() => null);
  if (!res) throw unavailable();
  if (!res.ok) throw new ApiError("CONFLICT", `LivePin refused the API key and secret (${res.status}). Check them in Settings → Tracking provider.`);
  const body = (await res.json().catch(() => null)) as { jwt?: string } | null;
  if (!body?.jwt) throw unavailable("sign-in returned no token");
  tokens.set(acc.id, { jwt: body.jwt, expires: Date.now() + TOKEN_SECONDS * 1000 });
  return body.jwt;
}

async function call(acc: Account, path: string, init: RequestInit = {}, retried = false): Promise<unknown> {
  const jwt = await signIn(acc);
  const res = await fetch(`${acc.baseUrl}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), "x-api-key": acc.apiKey, authorization: `Bearer ${jwt}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  }).catch(() => null);
  if (!res) throw unavailable();
  if (res.status === 401 && !retried) {
    tokens.delete(acc.id);
    return call(acc, path, init, true);
  }
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!res.ok) {
    const message = body?.error?.message ?? `request failed (${res.status})`;
    throw new ApiError(res.status >= 500 ? "INTERNAL" : "CONFLICT", `Tracking provider: ${message}`);
  }
  return body;
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const id = (v: string) => encodeURIComponent(v);

/** The LivePin client for one school. Throws CONFLICT when not configured. */
export async function livepin(schoolId: string) {
  const acc = await account(schoolId);
  if (!acc) throw new ApiError("CONFLICT", "LivePin is not set up. Add the API key and secret in Settings → Tracking provider.");
  return {
    test: async () => {
      await signIn(acc, true);
      await db.trackingAccount.update({ where: { id: acc.id }, data: { lastCheckedAt: new Date(), lastError: null } });
    },
    listFleet: async () => parseFleet(await call(acc, "/api/v2/vehicles")),
    location: async (vehicleId: string) => parseLocation(await call(acc, `/api/vehicles/${id(vehicleId)}/location`)),
    dayReport: async (vehicleId: string, day: string) =>
      parseDayReport(await call(acc, `/api/vehicles/${id(vehicleId)}/report?record_date=${encodeURIComponent(vendorDate(day))}`)),
    history: async (vehicleId: string, from: Date, to: Date) => {
      const q = new URLSearchParams({ start_timestamp: String(from.getTime()), end_timestamp: String(to.getTime()) });
      return parseHistory(await call(acc, `/api/vehicles/${id(vehicleId)}/location-history?${q}`));
    },
    alerts: async (vehicleId: string, from: Date, to: Date) => {
      const q = new URLSearchParams({ vehicle_id: vehicleId, start_timestamp: String(from.getTime()), end_timestamp: String(to.getTime()) });
      return parseAlerts(await call(acc, `/api/notifications/alerts?${q}`));
    },
    alertTypes: async () => {
      const r = z.array(z.object({ type: z.string(), label: z.string() })).safeParse(await call(acc, "/api/notifications/types"));
      return r.success ? r.data : [];
    },
    getPreferences: async (vehicleId: string): Promise<TrackerPreferences> => {
      const r = preferencesSchema.partial().safeParse(await call(acc, `/api/notifications/vehicle-preferences/${id(vehicleId)}`));
      const p = r.success ? r.data : {};
      return {
        overspeed: p.overspeed ?? true,
        overspeed_limit: p.overspeed_limit ?? 60,
        engine_on: p.engine_on ?? true,
        geofence_events: p.geofence_events ?? false,
        safe_parking: p.safe_parking ?? false,
        renewal: p.renewal ?? true,
      };
    },
    setPreferences: async (vehicleId: string, patch: Partial<TrackerPreferences>) => {
      await call(acc, `/api/notifications/update-preferences/${id(vehicleId)}`, json(patch));
    },
    getInterval: async (vehicleId: string) => {
      const r = z.object({ current_value: z.string() }).safeParse(await call(acc, `/api/vehicles/${id(vehicleId)}/location-update-intervals`));
      return r.success ? r.data.current_value : null;
    },
    setInterval: async (vehicleId: string, interval: TrackerInterval) => {
      await call(acc, `/api/vehicles/${id(vehicleId)}/location-update-intervals`, json({ interval }));
    },
    dashcamStream: async (vehicleId: string): Promise<string[]> => {
      let payload: unknown;
      try {
        payload = await call(acc, `/api/vehicles/${id(vehicleId)}/v2/get-dashcam-stream`);
      } catch (error) {
        if (error instanceof ApiError && /Failed to start/i.test(error.message)) {
          throw new ApiError("CONFLICT", "The camera is not reachable. The bus may be switched off or out of coverage.");
        }
        throw error;
      }
      const urls = parseStreamUrls(payload);
      if (!urls.length) throw unavailable("no stream returned");
      return urls;
    },
  };
}

export type LivePinClient = Awaited<ReturnType<typeof livepin>>;
