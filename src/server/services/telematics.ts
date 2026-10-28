import "server-only";
import { z } from "zod";
import type { Ctx } from "@/server/http/handler";
import type { Tx } from "@/server/db";
import { conflict, notFound } from "@/server/http/errors";
import { INTERVALS, livepin, preferencesSchema, type TrackerInterval } from "@/server/vendors/livepin";
import { addDays, localDate } from "@/lib/time";
import { splitTrips, stopVisits, type RoutePin } from "@/lib/trips";
import { alertKind } from "@/lib/alert-kind";
import type { BusTrail, BusTrip, BusTrips, DayPoint, DayReport, TripAlert, FleetTelematicsRow, TelematicsDay, TelematicsLive, TrackerAlertRow, TrackerSettings } from "@/lib/api/types";

/**
 * Everything the tracker vendor knows about one bus, for the bus page:
 * live readings and sensors, device health, the daily report and track,
 * the alert feed, and the tracker's settings (editable, audited).
 *
 * Vendor reads are cached briefly per vehicle so a screen that polls does
 * not turn into a stream of vendor calls.
 */

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.clear();
  return value;
}

/** The bus and its linked tracker, or a clear error. */
export async function trackerFor(db: Tx, schoolId: string, busId: string) {
  const bus = await db.bus.findFirst({ where: { id: busId, schoolId, deletedAt: null } });
  if (!bus) throw notFound("Bus");
  const device = await db.gpsDevice.findFirst({ where: { schoolId, busId: bus.id } });
  if (!device?.externalVehicleId) throw conflict(`Bus ${bus.number} has no GPS tracker linked.`);
  return { bus, device, vehicleId: device.externalVehicleId };
}

export const ALERT_LABELS: Record<string, string> = {
  engine_status: "Engine on/off",
  main_power_undervoltage: "Low main power",
  main_power_off: "Main power cut",
  storage_failure: "Camera storage failure",
  user_defined_alarm: "Driver assistance (ADAS)",
  overspeed: "Overspeed",
  sos: "SOS / emergency",
  emergency: "SOS / emergency",
  safe_parking: "Safe parking",
  low_battery: "Low battery",
  low_external_voltage: "Low external voltage",
  vibration: "Vibration",
  wire_disconnect: "Wire disconnected",
  geofence_enter: "Geofence enter",
  geofence_exit: "Geofence exit",
};

/** Each trip's alerts that carry a position, from the stored vendor feed. */
async function withAlerts(db: Tx, schoolId: string, busId: string, day: string, trips: BusTrip[]): Promise<BusTrip[]> {
  if (!trips.length) return trips;
  const events = await db.trackerEvent.findMany({
    where: {
      schoolId,
      busId,
      at: { gte: new Date(`${day}T00:00:00+05:30`), lt: new Date(`${addDays(day, 1)}T00:00:00+05:30`) },
      lat: { not: null },
      lng: { not: null },
    },
    orderBy: { at: "asc" },
  });
  const now = Date.now();
  return trips.map((t) => {
    const from = Date.parse(t.start);
    const to = t.end ? Date.parse(t.end) : now;
    const alerts: TripAlert[] = events
      .filter((e) => +e.at >= from && +e.at <= to)
      .map((e) => ({
        id: e.id,
        kind: alertKind(e.type, `${e.title} ${e.description ?? ""}`),
        label: ALERT_LABELS[e.type] ?? e.title,
        description: e.description,
        at: e.at.toISOString(),
        lat: e.lat!,
        lng: e.lng!,
      }));
    return { ...t, alerts };
  });
}

export async function liveDetail(ctx: Ctx, busId: string): Promise<TelematicsLive> {
  const { device, vehicleId } = await trackerFor(ctx.db, ctx.schoolId, busId);
  return cached(`live:${ctx.schoolId}:${vehicleId}`, 15_000, async () => {
    const client = await livepin(ctx.schoolId);
    const now = new Date();
    const [location, history, fleet, prefs, interval] = await Promise.all([
      client.location(vehicleId),
      client.history(vehicleId, new Date(now.getTime() - 6 * 3_600_000), now).catch(() => null),
      cached(`fleet:${ctx.schoolId}`, 60_000, () => client.listFleet()),
      client.getPreferences(vehicleId).catch(() => null),
      client.getInterval(vehicleId).catch(() => null),
    ]);
    const vehicle = fleet.find((v) => v.vehicleId === vehicleId);
    const l = location;
    if (prefs && prefs.overspeed_limit !== device.speedLimit) {
      await ctx.db.gpsDevice.update({ where: { id: device.id }, data: { speedLimit: prefs.overspeed_limit } });
    }
    return {
      vehicleNo: vehicle?.vehicleNo ?? device.vehicleNo ?? "",
      vehicleId,
      vehicleType: vehicle?.vehicleType ?? null,
      imei: device.imei,
      model: vehicle?.model ?? null,
      subscriptionExpiry: vehicle?.subscriptionExpiry ?? null,
      dashcamChannels: device.dashcamChannels,
      fix: {
        lat: l?.lat ?? device.lastLat,
        lng: l?.lng ?? device.lastLng,
        altitude: l?.altitude ?? null,
        speed: Math.round(l?.speed ?? device.lastSpeed ?? 0),
        heading: l?.heading ?? device.lastHeading,
        ignition: l?.ignition ?? device.lastIgnition,
        at: (l?.at ?? device.lastFixAt)?.toISOString() ?? null,
        receivedAt: l?.receivedAt?.toISOString() ?? null,
        delayS: l?.at && l.receivedAt ? Math.max(0, Math.round((+l.receivedAt - +l.at) / 1000)) : null,
        status: l?.status ?? device.lastStatus,
        statusSince: l?.statusSince?.toISOString() ?? null,
        address: l?.address ?? device.lastAddress,
      },
      alarms: l?.alarms ?? [],
      alarmFlags: l?.alarmFlags ?? {},
      sensors: l?.sensors ?? {
        gpsLock: null, running: null, load: null, fuelLineConnected: null, circuitConnected: null, doorLocked: null,
        doors: { front: null, middle: null, back: null, driver: null, other: null }, constellations: [],
      },
      health: {
        batteryPercent: l?.batteryPercent ?? null,
        externalVoltage: history?.health.externalVoltage ?? null,
        batteryVoltage: history?.health.batteryVoltage ?? null,
        satellites: history?.health.satellites ?? null,
        gsmSignal: history?.health.gsmSignal ?? null,
        gsmOperator: history?.health.gsmOperator ?? null,
        gnssStatus: history?.health.gnssStatus ?? null,
        at: history?.health.at?.toISOString() ?? null,
      },
      // Null when LivePin did not answer: never show settings the tracker did not report.
      settings: prefs ? { ...prefs, interval } : null,
    };
  });
}

/**
 * One bus's day from the vendor: the daily report and the full track, IST
 * midnight to midnight. Today is re-read every minute, past days every half hour.
 */
export async function loadDay(schoolId: string, vehicleId: string, day: string): Promise<{ report: DayReport | null; points: DayPoint[] }> {
  const ttl = day === localDate() ? 60_000 : 30 * 60_000;
  return cached(`day:${schoolId}:${vehicleId}:${day}`, ttl, async () => {
    const client = await livepin(schoolId);
    const from = new Date(`${day}T00:00:00+05:30`);
    const to = new Date(`${addDays(day, 1)}T00:00:00+05:30`);
    const [report, history] = await Promise.all([client.dayReport(vehicleId, day), client.history(vehicleId, from, to)]);
    return { report, points: history.points.map((p) => ({ lat: p.lat, lng: p.lng, speed: p.speed, ignition: p.ignition, at: p.at.toISOString() })) };
  });
}

const tripsOf = (day: { report: DayReport | null; points: Array<{ lat: number; lng: number; at: string }> }): BusTrip[] =>
  day.report ? splitTrips(day.report.timeline, day.report.stops, day.points) : [];

/** The pinned stops on the bus's route, in order, to judge each trip against. */
export async function routePins(db: Tx, busId: string): Promise<RoutePin[]> {
  const bus = await db.bus.findUnique({ where: { id: busId }, select: { routeId: true } });
  if (!bus?.routeId) return [];
  const rows = await db.routeStop.findMany({ where: { routeId: bus.routeId }, include: { stop: true }, orderBy: { sequence: "asc" } });
  return rows
    .filter((r) => !r.stop.deletedAt && r.stop.lat != null && r.stop.lng != null)
    .map((r) => ({ id: r.stop.id, name: r.stop.name, seq: r.sequence, lat: r.stop.lat!, lng: r.stop.lng! }));
}

/** Each trip's route stops where the bus did not stop. */
function withMissed(trips: BusTrip[], points: Array<{ lat: number; lng: number; speed: number; at: string }>, pins: RoutePin[]): BusTrip[] {
  if (!pins.length) return trips;
  const where = new Map(pins.map((p) => [p.id, p]));
  return trips.map((t) => ({
    ...t,
    missed: stopVisits(points, pins, Date.parse(t.start), t.end ? Date.parse(t.end) : Date.now(), t.running)
      .filter((v) => v.status !== "stopped")
      .map((v) => ({ stopId: v.stopId, name: v.name, lat: where.get(v.stopId)!.lat, lng: where.get(v.stopId)!.lng, status: v.status as "passed" | "missed", at: v.at })),
  }));
}

/** The vendor's daily report and that day's track (thinned to ≤ 1500 points). */
export async function dayDetail(ctx: Ctx, busId: string, day: string): Promise<TelematicsDay> {
  const { vehicleId } = await trackerFor(ctx.db, ctx.schoolId, busId);
  const { report, points } = await loadDay(ctx.schoolId, vehicleId, day);
  const step = Math.max(1, Math.ceil(points.length / 1500));
  return { date: day, report, track: points.filter((_, i) => i % step === 0 || i === points.length - 1) };
}

/** The day cut into trips (A, B, …), each with its stops and road, for the live map's Route tab. */
export async function dayTrips(ctx: Ctx, busId: string, day: string): Promise<BusTrips> {
  const { bus, vehicleId } = await trackerFor(ctx.db, ctx.schoolId, busId);
  const loaded = await loadDay(ctx.schoolId, vehicleId, day);
  const trips = withMissed(tripsOf(loaded), loaded.points, await routePins(ctx.db, bus.id));
  return { date: day, trips: await withAlerts(ctx.db, ctx.schoolId, bus.id, day, trips) };
}

/**
 * What the live maps draw for each linked bus: today's running trip, or its
 * last trip when parked. A bus that has not moved today, or whose history
 * cannot be read, is left out rather than guessed.
 */
export async function todayTrails(db: Tx, schoolId: string): Promise<BusTrail[]> {
  const devices = await db.gpsDevice.findMany({
    where: { schoolId, busId: { not: null }, externalVehicleId: { not: null } },
    select: { busId: true, externalVehicleId: true },
  });
  if (!devices.length) return [];
  const buses = new Map(
    (await db.bus.findMany({ where: { schoolId, id: { in: devices.map((d) => d.busId!) }, deletedAt: null }, select: { id: true, number: true } })).map((b) => [b.id, b.number]),
  );
  const today = localDate();
  const trails = await Promise.all(
    devices.map(async (d): Promise<BusTrail | null> => {
      const number = buses.get(d.busId!);
      if (!number) return null;
      try {
        const loaded = await loadDay(schoolId, d.externalVehicleId!, today);
        const trips = withMissed(tripsOf(loaded), loaded.points, await routePins(db, d.busId!));
        const latest = trips.find((t) => t.running) ?? trips[trips.length - 1];
        if (!latest || latest.points.length < 2) return null;
        const [trip] = await withAlerts(db, schoolId, d.busId!, today, [latest]);
        const { label, running, start, end, from, to, points, stops, alerts, missed } = trip!;
        return { busId: d.busId!, number, label, running, start, end, from, to, points, stops, alerts, missed };
      } catch {
        return null;
      }
    }),
  );
  return trails.filter((t): t is BusTrail => !!t);
}

export const alertQuery = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  type: z.string().max(60).optional(),
});

/** Alerts we have stored from the vendor feed (synced every minute). */
export async function alertFeed(
  ctx: Ctx,
  busId: string,
  q: z.infer<typeof alertQuery>,
): Promise<{ items: TrackerAlertRow[]; types: Array<{ type: string; label: string; count: number }>; catalogue: Array<{ type: string; label: string }> }> {
  const bus = await ctx.db.bus.findFirst({ where: { id: busId, schoolId: ctx.schoolId, deletedAt: null } });
  if (!bus) throw notFound("Bus");
  const to = q.to ?? localDate();
  const from = q.from ?? addDays(to, -6);
  const where = {
    schoolId: ctx.schoolId,
    busId: bus.id,
    at: { gte: new Date(`${from}T00:00:00+05:30`), lt: new Date(`${addDays(to, 1)}T00:00:00+05:30`) },
  };
  const [rows, all] = await Promise.all([
    ctx.db.trackerEvent.findMany({ where: { ...where, ...(q.type ? { type: q.type } : {}) }, orderBy: { at: "desc" }, take: 500 }),
    ctx.db.trackerEvent.groupBy({ by: ["type"], where, _count: { _all: true } }),
  ]);
  const incidents = new Map(
    (await ctx.db.incident.findMany({ where: { id: { in: rows.map((r) => r.incidentId).filter((x): x is string => !!x) } }, select: { id: true, code: true } })).map((i) => [i.id, i]),
  );
  // Every alert type LivePin can send, so the office sees what the tracker watches for.
  const catalogue = await cached(`alert-types:${ctx.schoolId}`, 60 * 60_000, async () => (await livepin(ctx.schoolId)).alertTypes()).catch(
    () => [] as Array<{ type: string; label: string }>,
  );
  return {
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      label: ALERT_LABELS[r.type] ?? r.title,
      title: r.title,
      description: r.description,
      priority: r.priority,
      at: r.at.toISOString(),
      lat: r.lat,
      lng: r.lng,
      incident: r.incidentId ? (incidents.get(r.incidentId) ?? { id: r.incidentId, code: null }) : null,
    })),
    types: all
      .map((g) => ({ type: g.type, label: ALERT_LABELS[g.type] ?? g.type, count: g._count._all }))
      .sort((a, b) => b.count - a.count),
    catalogue: catalogue.map((c) => ({ type: c.type, label: ALERT_LABELS[c.type] ?? c.label })),
  };
}

export const settingsSchema = preferencesSchema.partial().extend({
  interval: z.enum(INTERVALS).optional(),
});

/** Change a tracker's alert settings / reporting interval at the vendor. Audited before → after. */
export async function updateSettings(ctx: Ctx, busId: string, input: z.infer<typeof settingsSchema>): Promise<TrackerSettings> {
  const { bus, vehicleId } = await trackerFor(ctx.db, ctx.schoolId, busId);
  const client = await livepin(ctx.schoolId);
  const before = { ...(await client.getPreferences(vehicleId)), interval: await client.getInterval(vehicleId) };
  const { interval, ...prefs } = input;
  const changedPrefs = Object.fromEntries(
    Object.entries(prefs).filter(([k, v]) => v !== undefined && before[k as keyof typeof before] !== v),
  );
  if (Object.keys(changedPrefs).length) await client.setPreferences(vehicleId, changedPrefs);
  if (interval && interval !== before.interval) await client.setInterval(vehicleId, interval as TrackerInterval);
  const after = { ...(await client.getPreferences(vehicleId)), interval: await client.getInterval(vehicleId) };
  await ctx.db.gpsDevice.updateMany({
    where: { schoolId: ctx.schoolId, busId: bus.id },
    data: { speedLimit: after.overspeed_limit },
  });
  cache.delete(`live:${ctx.schoolId}:${vehicleId}`);
  ctx.audit({
    action: "TRACKER_SETTINGS",
    entityType: "Bus",
    entityId: bus.id,
    meta: { before, after },
  });
  return after;
}

/** A tracker's current settings, read from LivePin before it is linked (the bus form starts from these). */
export async function vehicleSettings(schoolId: string, vehicleId: string): Promise<TrackerSettings> {
  const client = await livepin(schoolId);
  const fleet = await client.listFleet();
  if (!fleet.some((v) => v.vehicleId === vehicleId)) throw notFound("Tracker");
  const [prefs, interval] = await Promise.all([client.getPreferences(vehicleId), client.getInterval(vehicleId)]);
  return { ...prefs, interval };
}

/** Today's (or a day's) vendor totals for every linked bus. */
export async function fleetDay(db: Tx, schoolId: string, day: string): Promise<FleetTelematicsRow[]> {
  const devices = await db.gpsDevice.findMany({ where: { schoolId, busId: { not: null } } });
  if (!devices.length) return [];
  const buses = new Map(
    (await db.bus.findMany({ where: { id: { in: devices.map((d) => d.busId!) } }, select: { id: true, number: true } })).map((b) => [b.id, b.number]),
  );
  const client = await livepin(schoolId);
  return Promise.all(
    devices.map(async (d) => {
      try {
        const report = await cached(`fleetday:${schoolId}:${d.externalVehicleId}:${day}`, 5 * 60_000, () =>
          client.dayReport(d.externalVehicleId!, day),
        );
        return { bus: `Bus ${buses.get(d.busId!) ?? ""}`, vehicleNo: d.vehicleNo ?? "", report, error: null };
      } catch (error) {
        return { bus: `Bus ${buses.get(d.busId!) ?? ""}`, vehicleNo: d.vehicleNo ?? "", report: null, error: error instanceof Error ? error.message : "Unavailable" };
      }
    }),
  );
}
