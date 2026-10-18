import "server-only";
import { z } from "zod";
import { db, inParallel, type Tx } from "@/server/db";
import type { Ctx } from "@/server/http/handler";
import { ApiError, conflict, notFound } from "@/server/http/errors";
import { notifyAdmins } from "@/server/services/notify";
import { nextIncidentCode } from "@/server/services/safety";
import { accountConfigured, livepin, playerUrl, type LivePinAlert, type LivePinVehicle } from "@/server/vendors/livepin";
import { dbDate, formatTime, localDate } from "@/lib/time";
import { delayMinutes, distanceM, etaMinutes, localMinutes, nextStop, type StopOnRoute } from "@/lib/geo";
import type { BusLive, LiveFleet, OneBusLive } from "@/lib/api/types";
import type { Severity } from "@/generated/prisma/client";

/**
 * Live tracking: links vendor trackers to buses, pulls the fleet's latest
 * fixes into our database (last fix, 30 days of pings, bus status, trip
 * delay, alarms → incidents), and builds the live view the three apps read.
 *
 * `syncFleet` runs from the cron route every minute and, throttled to every
 * 30 seconds, whenever a live screen asks — so development works without cron.
 */

const PROVIDER = "LIVEPIN";
export const STALE_MS = 10 * 60_000;
const SYNC_EVERY_MS = 30_000;
const ALARM_REPEAT_MS = 30 * 60_000;
const KEEP_PINGS_DAYS = 30;
const MOVING_KPH = 3;

/** Vendor alarm → incident. Alarms not listed are shown on the map only. */
/**
 * Alarm flags on the live fix → incidents. SOS, overspeed and tamper come
 * through the alert feed (FEED_RULES); these flags cover what the feed may
 * not report, and share its de-duplication.
 */
const ALARMS: Record<string, { type: string; severity: Severity; notify: boolean }> = {
  emergency: { type: "SOS", severity: "CRITICAL", notify: true },
  collision_warning: { type: "Collision warning", severity: "HIGH", notify: true },
  rollover_warning: { type: "Rollover warning", severity: "HIGH", notify: true },
};

// ── Linking ───────────────────────────────────────────────────────────────

export async function vendorVehicles(schoolId: string) {
  if (!(await accountConfigured(schoolId))) return { configured: false, vehicles: [] };
  const client = await livepin(schoolId);
  const [fleet, devices] = await Promise.all([
    client.listFleet(),
    db.gpsDevice.findMany({ where: { schoolId, provider: PROVIDER } }),
  ]);
  const buses = new Map(
    (await db.bus.findMany({ where: { schoolId, deletedAt: null }, select: { id: true, number: true } })).map((b) => [b.id, b.number]),
  );
  return {
    configured: true,
    vehicles: fleet.map((v) => {
      const linked = devices.find((d) => d.externalVehicleId === v.vehicleId && d.busId);
      return {
        vehicleId: v.vehicleId,
        vehicleNo: v.vehicleNo,
        imei: v.imei,
        dashcamChannels: v.dashcamChannels,
        status: v.status,
        model: v.model,
        interval: v.updateInterval,
        subscriptionExpiry: v.subscriptionExpiry,
        lastFix: v.fix ? v.fix.at.toISOString() : null,
        busId: linked?.busId ?? null,
        bus: linked?.busId ? `Bus ${buses.get(linked.busId) ?? ""}` : null,
      };
    }),
  };
}

export const linkSchema = z.object({
  busId: z.string().min(1),
  /** LivePin vehicle id, or null to unlink the bus. */
  vehicleId: z.string().min(1).nullable(),
});

const channelKey = (vehicleId: string, n: number) => `livepin:${vehicleId}:${n}`;

/** Link a vendor tracker to a bus (one bus per tracker, one tracker per bus). */
export async function linkDevice(ctx: Ctx, input: z.infer<typeof linkSchema>) {
  const { schoolId } = ctx;
  const tx = ctx.db;
  const bus = await tx.bus.findFirst({ where: { id: input.busId, schoolId, deletedAt: null } });
  if (!bus) throw notFound("Bus");

  // Unlink whatever this bus had.
  const current = await tx.gpsDevice.findFirst({ where: { schoolId, busId: bus.id } });
  if (current) {
    await tx.gpsDevice.update({ where: { id: current.id }, data: { busId: null } });
    await tx.camera.deleteMany({ where: { busId: bus.id, streamKey: { startsWith: "livepin:" } } });
  }
  await tx.bus.update({ where: { id: bus.id }, data: { gpsDeviceId: null } });

  if (!input.vehicleId) {
    ctx.audit({ action: "UNLINK_TRACKER", entityType: "Bus", entityId: bus.id });
    return;
  }

  const vehicle = (await (await livepin(schoolId)).listFleet()).find((v) => v.vehicleId === input.vehicleId);
  if (!vehicle) throw notFound("Tracker");
  const taken = await tx.gpsDevice.findFirst({
    where: { schoolId, provider: PROVIDER, externalVehicleId: vehicle.vehicleId, busId: { not: null } },
  });
  if (taken) throw conflict("That tracker is already linked to another bus. Unlink it there first.");

  const device = await tx.gpsDevice.upsert({
    where: { schoolId_provider_externalVehicleId: { schoolId, provider: PROVIDER, externalVehicleId: vehicle.vehicleId } },
    create: {
      schoolId, provider: PROVIDER, imei: vehicle.imei, externalDeviceId: vehicle.deviceId,
      externalVehicleId: vehicle.vehicleId, vehicleNo: vehicle.vehicleNo, dashcamChannels: vehicle.dashcamChannels, busId: bus.id,
    },
    update: { busId: bus.id, imei: vehicle.imei, vehicleNo: vehicle.vehicleNo, dashcamChannels: vehicle.dashcamChannels },
  });
  await tx.bus.update({ where: { id: bus.id }, data: { gpsDeviceId: device.id } });

  // The dashcam's channels become the bus's cameras.
  await tx.camera.deleteMany({ where: { busId: bus.id } });
  for (let n = 1; n <= vehicle.dashcamChannels; n++) {
    await tx.camera.create({
      data: { schoolId, busId: bus.id, label: `Channel ${n}`, streamKey: channelKey(vehicle.vehicleId, n), status: "ONLINE", firmware: "LivePin" },
    });
  }
  await applyFix(tx, schoolId, device.id, vehicle);
  ctx.audit({ action: "LINK_TRACKER", entityType: "Bus", entityId: bus.id, meta: { provider: PROVIDER, vehicleNo: vehicle.vehicleNo } });
}

// ── Sync ──────────────────────────────────────────────────────────────────

const lastSync = new Map<string, number>();

/** Pull the vendor fleet into our tables. Throttled unless `force`. */
export async function syncFleet(schoolId: string, force = false): Promise<{ synced: number; skipped?: boolean }> {
  if (!(await accountConfigured(schoolId))) return { synced: 0, skipped: true };
  const prev = lastSync.get(schoolId) ?? 0;
  if (!force && Date.now() - prev < SYNC_EVERY_MS) return { synced: 0, skipped: true };
  lastSync.set(schoolId, Date.now());

  const devices = await db.gpsDevice.findMany({ where: { schoolId, provider: PROVIDER, busId: { not: null } } });
  if (!devices.length) return { synced: 0 };
  const client = await livepin(schoolId);
  const fleet = await client.listFleet();
  let synced = 0;
  for (const device of devices) {
    const vehicle = fleet.find((v) => v.vehicleId === device.externalVehicleId);
    if (!vehicle) continue;
    await db.$transaction((tx) => applyFix(tx, schoolId, device.id, vehicle), { timeout: 15_000 });
    // The vendor's alert feed, from where we last stopped (first sync: 24 h).
    const from = device.alertsCursor ?? new Date(Date.now() - 86_400_000);
    const to = new Date();
    const feed = await client.alerts(device.externalVehicleId!, from, to).catch(() => null);
    if (feed) {
      await db.$transaction((tx) => ingestAlerts(tx, schoolId, device.id, feed), { timeout: 20_000 });
      await db.gpsDevice.update({ where: { id: device.id }, data: { alertsCursor: to } });
    }
    synced++;
  }
  const cutoff = new Date(Date.now() - KEEP_PINGS_DAYS * 86_400_000);
  await db.locationPing.deleteMany({ where: { schoolId, recordedAt: { lt: cutoff } } });
  await db.trackerEvent.deleteMany({ where: { schoolId, at: { lt: cutoff } } });
  return { synced };
}

/** Store one vendor fix and react to it. */
async function applyFix(tx: Tx, schoolId: string, deviceId: string, v: LivePinVehicle) {
  const device = await tx.gpsDevice.findUniqueOrThrow({ where: { id: deviceId } });
  const fix = v.fix;
  await tx.gpsDevice.update({
    where: { id: device.id },
    data: {
      lastStatus: v.status,
      lastAddress: v.address,
      dashcamChannels: v.dashcamChannels,
      ...(fix
        ? { lastLat: fix.lat, lastLng: fix.lng, lastSpeed: fix.speed, lastHeading: fix.heading, lastIgnition: fix.ignition, lastFixAt: fix.at, lastPingAt: new Date() }
        : {}),
    },
  });
  if (!device.busId || !fix) return;

  const bus = await tx.bus.findUniqueOrThrow({ where: { id: device.busId } });
  const today = localDate();
  const trip = await tx.trip.findFirst({ where: { busId: bus.id, date: dbDate(today), status: "ACTIVE" } });
  const fresh = Date.now() - fix.at.getTime() < STALE_MS;

  // History: one ping per fix.
  if (!device.lastFixAt || fix.at > device.lastFixAt) {
    await tx.locationPing.createMany({
      data: [{ schoolId, busId: bus.id, tripId: trip?.id ?? null, lat: fix.lat, lng: fix.lng, speedKph: fix.speed, heading: fix.heading, ignition: fix.ignition, recordedAt: fix.at }],
      skipDuplicates: true,
    });
  }

  // Bus status from the fix; maintenance is set by people, never by GPS.
  if (bus.status !== "MAINTENANCE") {
    let status: "ACTIVE" | "IDLE" | "OFFLINE" | "DELAYED" = !fresh ? "OFFLINE" : fix.speed > MOVING_KPH ? "ACTIVE" : "IDLE";
    if (trip && fresh) {
      const delay = await tripDelay(tx, trip.routeId, trip.phase, fix);
      await tx.trip.update({ where: { id: trip.id }, data: { delayMin: delay } });
      const school = await tx.school.findUniqueOrThrow({ where: { id: schoolId }, select: { settings: true } });
      const threshold = (school.settings as { delayThresholdMin?: number } | null)?.delayThresholdMin ?? 5;
      if (delay > threshold) status = "DELAYED";
    }
    if (status !== bus.status) await tx.bus.update({ where: { id: bus.id }, data: { status } });
  }

  // Camera health follows the dashcam's own report.
  const cameraFault = fix.alarms.includes("camera_malfunction");
  await tx.camera.updateMany({
    where: { busId: bus.id, streamKey: { startsWith: "livepin:" } },
    data: { status: !fresh ? "OFFLINE" : cameraFault ? "RECORDING_ISSUE" : "ONLINE", ...(fresh ? { lastSeenAt: fix.at } : {}) },
  });

  // Alarms → incidents, at most once per alarm type per 30 minutes.
  if (!fresh) return;
  const state = { ...((device.alarmState as Record<string, string>) ?? {}) };
  let changed = false;
  for (const alarm of fix.alarms) {
    const rule = ALARMS[alarm];
    if (!rule) continue;
    const last = state[rule.type] ? Date.parse(state[rule.type]!) : 0;
    if (Date.now() - last < ALARM_REPEAT_MS) continue;
    state[rule.type] = new Date().toISOString();
    changed = true;
    await raiseIncident(tx, schoolId, bus, trip?.id ?? null, rule, fix);
  }
  if (changed) await tx.gpsDevice.update({ where: { id: device.id }, data: { alarmState: state } });
}

export async function raiseIncident(
  tx: Tx,
  schoolId: string,
  bus: { id: string; number: string },
  tripId: string | null,
  rule: { type: string; severity: Severity; notify: boolean },
  fix: { lat: number; lng: number; speed: number; at: Date },
  source = "the bus's tracker",
) {
  const school = await tx.school.findUniqueOrThrow({ where: { id: schoolId }, select: { timezone: true } });
  const when = formatTime(fix.at, school.timezone);
  const description = `${rule.type} reported by ${source} on Bus ${bus.number} at ${when}, ${Math.round(fix.speed)} km/h, near ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}.`;
  const incident = await tx.incident.create({
    data: {
      schoolId, code: await nextIncidentCode(tx, schoolId), busId: bus.id, tripId, type: rule.type,
      severity: rule.severity, status: "NEW", description, occurredAt: fix.at,
      assignedTo: "Transport office", clipIds: [],
      events: { create: { actorId: "system", action: "CREATED", note: `Raised automatically from ${source}.` } },
    },
  });
  if (rule.notify) {
    await notifyAdmins(tx, schoolId, { type: "alert", title: `${rule.type} on Bus ${bus.number}`, body: description });
  }
  await tx.auditLog.create({
    data: { schoolId, actorType: "system", action: "TRACKER_ALARM", entityType: "Incident", entityId: incident.id, meta: { type: rule.type } },
  });
  return incident;
}

/** Vendor alert feed → incidents. Everything else is stored and shown only. */
export const FEED_RULES: Record<string, { type: string; severity: Severity; notify: boolean }> = {
  sos: { type: "SOS", severity: "CRITICAL", notify: true },
  emergency: { type: "SOS", severity: "CRITICAL", notify: true },
  main_power_off: { type: "Tracker power cut / tamper", severity: "HIGH", notify: true },
  wire_disconnect: { type: "Tracker power cut / tamper", severity: "HIGH", notify: true },
  vibration: { type: "Tracker power cut / tamper", severity: "HIGH", notify: true },
  tamper: { type: "Tracker power cut / tamper", severity: "HIGH", notify: true },
  overspeed: { type: "Overspeed", severity: "LOW", notify: false },
  user_defined_alarm: { type: "Driver assistance (ADAS) warning", severity: "LOW", notify: false },
};

/** Store new feed alerts; raise incidents per FEED_RULES, once per type per 30 minutes. */
export async function ingestAlerts(tx: Tx, schoolId: string, deviceId: string, feed: LivePinAlert[]) {
  const device = await tx.gpsDevice.findUniqueOrThrow({ where: { id: deviceId } });
  if (!device.busId || !feed.length) return 0;
  const known = new Set(
    (await tx.trackerEvent.findMany({ where: { externalId: { in: feed.map((a) => a.externalId) } }, select: { externalId: true } })).map((e) => e.externalId),
  );
  const fresh = feed.filter((a) => !known.has(a.externalId)).sort((a, b) => +a.at - +b.at);
  if (!fresh.length) return 0;
  const bus = await tx.bus.findUniqueOrThrow({ where: { id: device.busId } });
  const trip = await tx.trip.findFirst({ where: { busId: bus.id, date: dbDate(localDate()), status: "ACTIVE" } });
  const state = { ...((device.alarmState as Record<string, string>) ?? {}) };
  for (const a of fresh) {
    let incidentId: string | null = null;
    const rule = FEED_RULES[a.type];
    // Old alerts (first sync) are recorded but do not open incidents.
    const recent = Date.now() - a.at.getTime() < 6 * 3_600_000;
    if (rule && recent) {
      const last = state[rule.type] ? Date.parse(state[rule.type]!) : 0;
      if (a.at.getTime() - last >= ALARM_REPEAT_MS) {
        state[rule.type] = a.at.toISOString();
        const incident = await raiseIncident(
          tx, schoolId, bus, trip?.id ?? null, rule,
          { lat: a.lat ?? device.lastLat ?? 0, lng: a.lng ?? device.lastLng ?? 0, speed: device.lastSpeed ?? 0, at: a.at },
          `a LivePin alert (${a.title})`,
        );
        incidentId = incident.id;
      }
    }
    await tx.trackerEvent.create({
      data: { schoolId, busId: bus.id, externalId: a.externalId, type: a.type, title: a.title, description: a.description, priority: a.priority, lat: a.lat, lng: a.lng, at: a.at, incidentId },
    });
  }
  await tx.gpsDevice.update({ where: { id: device.id }, data: { alarmState: state } });
  return fresh.length;
}

/** The route's stops in trip order (evening runs backwards), with this trip's times. */
async function tripStops(tx: Tx, routeId: string, phase: "MORNING" | "EVENING"): Promise<StopOnRoute[]> {
  const rows = await tx.routeStop.findMany({ where: { routeId }, include: { stop: true }, orderBy: { sequence: "asc" } });
  const stops = rows
    .filter((r) => r.stop.lat != null && r.stop.lng != null)
    .map((r) => ({ id: r.stopId, name: r.stop.name, lat: r.stop.lat!, lng: r.stop.lng!, time: phase === "MORNING" ? r.pickupTime : r.dropTime }));
  return phase === "MORNING" ? stops : stops.reverse();
}

async function tripDelay(tx: Tx, routeId: string, phase: "MORNING" | "EVENING", fix: { lat: number; lng: number; speed: number }) {
  const next = nextStop(fix, await tripStops(tx, routeId, phase));
  if (!next) return 0;
  return delayMinutes(localMinutes(new Date()), etaMinutes(next.metres, fix.speed), next.stop.time);
}

// ── Live view ─────────────────────────────────────────────────────────────

/** Every bus with its last fix, trip and ETA, plus route lines for the map. */
export async function liveFleet(client: Tx, schoolId: string): Promise<LiveFleet> {
  const today = localDate();
  const [buses, routes, trips] = await inParallel(client, [
    () =>
      client.bus.findMany({
        where: { schoolId, deletedAt: null },
        include: { driver: true, attendant: true, route: true, cameras: { select: { status: true } }, _count: { select: { students: { where: { deletedAt: null } } } } },
        orderBy: { number: "asc" },
      }),
    () =>
      client.route.findMany({
        where: { schoolId, deletedAt: null },
        include: { stops: { include: { stop: true }, orderBy: { sequence: "asc" } } },
      }),
    () =>
      client.trip.findMany({
        where: { schoolId, date: dbDate(today), status: "ACTIVE" },
        include: { marks: { where: { undone: false } } },
      }),
  ] as const);
  const devices = await client.gpsDevice.findMany({ where: { schoolId, busId: { in: buses.map((b) => b.id) } } });

  const views: BusLive[] = [];
  for (const b of buses) {
    const d = devices.find((x) => x.busId === b.id);
    const trip = trips.find((t) => t.busId === b.id) ?? null;
    const fix =
      d && d.lastLat != null && d.lastLng != null && d.lastFixAt
        ? {
            lat: d.lastLat,
            lng: d.lastLng,
            speed: Math.round(d.lastSpeed ?? 0),
            heading: d.lastHeading,
            ignition: d.lastIgnition,
            at: d.lastFixAt.toISOString(),
            ageMin: Math.max(0, Math.round((Date.now() - d.lastFixAt.getTime()) / 60_000)),
            address: d.lastAddress,
          }
        : null;
    const stale = !fix || Date.now() - Date.parse(fix.at) > STALE_MS;
    const state: BusLive["state"] = !d ? "unlinked" : stale ? "offline" : fix!.speed > MOVING_KPH ? "moving" : fix!.ignition ? "idle" : "stopped";

    let tripView: BusLive["trip"] = null;
    if (trip) {
      const boarded = trip.marks.filter((m) => m.phase === "BOARD" && m.status === "BOARDED").length;
      const dropped = trip.marks.filter((m) => m.phase === "DROP" && m.status === "DROPPED").length;
      let next: { name: string; etaMin: number; distanceKm: number } | null = null;
      if (fix && !stale) {
        const route = routes.find((r) => r.id === trip.routeId);
        const ordered = (route?.stops ?? [])
          .filter((r) => r.stop.lat != null && r.stop.lng != null)
          .map((r) => ({ id: r.stopId, name: r.stop.name, lat: r.stop.lat!, lng: r.stop.lng!, time: trip.phase === "MORNING" ? r.pickupTime : r.dropTime }));
        const n = nextStop(fix, trip.phase === "MORNING" ? ordered : ordered.reverse());
        if (n) next = { name: n.stop.name, etaMin: etaMinutes(n.metres, fix.speed), distanceKm: Math.round(n.metres / 100) / 10 };
      }
      tripView = {
        id: trip.id,
        phase: trip.phase === "MORNING" ? "morning" : "evening",
        onboard: Math.max(0, boarded - dropped),
        delayMin: trip.delayMin,
        nextStop: next,
      };
    }

    views.push({
      busId: b.id,
      number: b.number,
      reg: b.registration,
      routeId: b.routeId,
      route: b.route?.name ?? null,
      driver: b.driver?.name ?? null,
      attendant: b.attendant?.name ?? null,
      capacity: b.capacity,
      riders: b._count.students,
      linked: !!d,
      vehicleNo: d?.vehicleNo ?? null,
      channels: d?.dashcamChannels ?? 0,
      camerasOnline: b.cameras.filter((c) => c.status === "ONLINE").length,
      camerasTotal: b.cameras.length,
      state,
      fix,
      trip: tripView,
      alarms: [],
    });
  }

  return {
    syncedAt: new Date().toISOString(),
    buses: views,
    routes: routes.map((r) => ({
      id: r.id,
      name: r.name,
      points: r.stops
        .filter((s) => s.stop.lat != null && s.stop.lng != null)
        .map((s) => ({ lat: s.stop.lat!, lng: s.stop.lng!, name: s.stop.name })),
    })),
  };
}

/** Distance in km from a bus's last fix to a point, for the parent's stop. */
export function kmTo(fix: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  return Math.round(distanceM(fix, to) / 100) / 10;
}

// ── Dashcam ───────────────────────────────────────────────────────────────

/** Start a bus's dashcam stream. Audited as a CCTV view. */
export async function openDashcam(ctx: Ctx, busId: string) {
  const bus = await ctx.db.bus.findFirst({ where: { id: busId, schoolId: ctx.schoolId, deletedAt: null } });
  if (!bus) throw notFound("Bus");
  const device = await ctx.db.gpsDevice.findFirst({ where: { schoolId: ctx.schoolId, busId: bus.id } });
  if (!device?.externalVehicleId || device.dashcamChannels < 1) {
    throw conflict(`Bus ${bus.number} has no dashcam linked.`);
  }
  ctx.audit({ action: "CCTV_VIEW", entityType: "Bus", entityId: bus.id, meta: { provider: PROVIDER, channels: device.dashcamChannels } });
  let urls: string[];
  try {
    urls = await (await livepin(ctx.schoolId)).dashcamStream(device.externalVehicleId);
  } catch (error) {
    // The camera can take a few seconds to wake; the first request may fail.
    if (error instanceof ApiError && error.code === "CONFLICT" && /not reachable/.test(error.message)) {
      throw conflict(`Bus ${bus.number}'s camera did not answer. It may be waking up — try again in a few seconds. If it keeps failing, the bus may be off or out of coverage.`);
    }
    throw error;
  }
  return { bus: `Bus ${bus.number}`, channels: urls.length, playerUrl: playerUrl(urls) };
}

// ── One bus, for the crew and parent apps ─────────────────────────────────

/** A single bus's last fix, its route line and ETAs. Null when no tracker or no fix. */
export async function oneBusLive(
  client: Tx,
  schoolId: string,
  busId: string,
  phase: "MORNING" | "EVENING" | null,
  stopId?: string | null,
): Promise<OneBusLive | null> {
  await syncFleet(schoolId).catch(() => undefined);
  const [device, bus] = await Promise.all([
    client.gpsDevice.findFirst({ where: { schoolId, busId } }),
    client.bus.findFirst({ where: { id: busId, schoolId }, select: { routeId: true } }),
  ]);
  if (!device || device.lastLat == null || device.lastLng == null || !device.lastFixAt) return null;
  const fix = { lat: device.lastLat, lng: device.lastLng, speed: device.lastSpeed ?? 0 };
  const offline = Date.now() - device.lastFixAt.getTime() > STALE_MS;
  const stops = bus?.routeId ? await tripStops(client, bus.routeId, phase ?? "MORNING") : [];

  let nextView: OneBusLive["nextStop"] = null;
  if (phase && !offline) {
    const n = nextStop(fix, stops);
    if (n) nextView = { name: n.stop.name, etaMin: etaMinutes(n.metres, fix.speed), distanceKm: Math.round(n.metres / 100) / 10 };
  }
  const target = stopId ? stops.find((s) => s.id === stopId) : undefined;
  const toStop = target && !offline
    ? { name: target.name, etaMin: etaMinutes(distanceM(fix, target), fix.speed), distanceKm: kmTo(fix, target) }
    : null;

  return {
    lat: fix.lat,
    lng: fix.lng,
    heading: device.lastHeading,
    speed: Math.round(fix.speed),
    ageMin: Math.max(0, Math.round((Date.now() - device.lastFixAt.getTime()) / 60_000)),
    offline,
    nextStop: nextView,
    toStop,
    route: stops.map((s) => ({ lat: s.lat, lng: s.lng, name: s.name })),
  };
}
