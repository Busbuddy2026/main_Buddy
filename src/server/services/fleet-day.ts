import "server-only";
import { z } from "zod";
import type { Ctx } from "@/server/http/handler";
import { db, type Tx } from "@/server/db";
import { readSettings } from "@/lib/api/schemas/settings";
import { addDays, dbDate, localDate } from "@/lib/time";
import { distanceM } from "@/lib/geo";
import { splitTrips, stopVisits } from "@/lib/trips";
import { afterHoursSpans, estimateFuel, idleSeconds, idleSpells, offRouteSpans, overspeedPoints } from "@/lib/fleet-metrics";
import { loadDay, routePins } from "@/server/services/telematics";
import type { Prisma } from "@/generated/prisma/client";

/**
 * One bus's day, worked out from the tracker and saved as a BusDay row, so
 * every analytics screen reads the database instead of waiting on LivePin.
 * Past days are computed once (nightly cron, or a rebuild); today is
 * recomputed when a screen asks and the saved copy is over 5 minutes old.
 */

const TODAY_FRESH_MS = 5 * 60_000;
/** An idle wait this close to a route stop is probably children boarding. */
const AT_STOP_M = 150;
const KEEP_DAYS = 400;
const lineSchema = z.array(z.object({ lat: z.number(), lng: z.number() }));

export interface IdleEvent {
  start: string;
  end: string;
  durationS: number;
  lat: number;
  lng: number;
  /** Name of the route stop it happened at, if any. */
  atStop: string | null;
}

/** Work out and save one bus's day. Null when the bus has no tracker. */
export async function computeBusDay(schoolId: string, busId: string, day: string) {
  const [bus, device, school, trip] = await Promise.all([
    db.bus.findFirst({ where: { id: busId, schoolId, deletedAt: null }, include: { route: true } }),
    db.gpsDevice.findFirst({ where: { schoolId, busId } }),
    db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { settings: true, timezone: true } }),
    db.trip.findFirst({ where: { busId, date: dbDate(day), driverId: { not: null } }, orderBy: { phase: "asc" }, select: { driverId: true } }),
  ]);
  if (!bus || !device?.externalVehicleId) return null;
  const settings = readSettings(school.settings);
  const tz = school.timezone;
  const { report, points } = await loadDay(schoolId, device.externalVehicleId, day);
  const pins = await routePins(db, busId);

  const trips = report ? splitTrips(report.timeline, report.stops, points) : [];
  const visits = trips.flatMap((t) =>
    stopVisits(points, pins, Date.parse(t.start), t.end ? Date.parse(t.end) : Date.now(), t.running).map((v) => ({
      stopId: v.stopId,
      trip: t.key,
      status: v.status,
      at: v.at,
    })),
  );
  const idleEvents: IdleEvent[] = idleSpells(points, 300).map((s) => {
    const near = pins.find((p) => distanceM(p, s) <= AT_STOP_M);
    return { ...s, atStop: near?.name ?? null };
  });
  // Our own count from the track (engine on, standing), never above the engine time:
  // the vendor's idle total is sometimes impossible (16 h of idling on a day with 1.5 h of engine).
  const counted = idleSeconds(points);
  const idleS = report?.engineOn ? Math.min(counted, report.engineOn) : counted;
  const km = report?.distanceKm ?? 0;
  const limit = device.speedLimit ?? report?.overspeedLimit ?? 60;
  const windows = [settings.morning, settings.evening];
  const line = lineSchema.safeParse(bus.route?.geometry);
  const fuel = estimateFuel({ km, idleS, mileageKmpl: bus.mileageKmpl, idleLph: bus.idleLph, dieselPriceRs: settings.dieselPriceRs });
  const first = trips[0];

  const data = {
    driverId: trip?.driverId ?? bus.driverId,
    distanceKm: km,
    movingS: report?.moving ?? 0,
    engineOnS: report?.engineOn ?? 0,
    idleS,
    parkedS: report?.parked ?? 0,
    maxSpeed: report?.maxSpeed ?? 0,
    avgSpeed: report?.avgSpeed ?? 0,
    overspeedKm: report?.overspeedKm ?? 0,
    overspeedCount: report?.overspeed.length ?? 0,
    estFuelL: fuel.litres,
    estCostRs: fuel.costRs,
    idleCostRs: fuel.idleCostRs,
    schoolArrivalAt: first && !first.running && first.end ? new Date(first.end) : null,
    idleEvents: idleEvents as unknown as Prisma.InputJsonValue,
    overspeedPoints: overspeedPoints(points, limit) as unknown as Prisma.InputJsonValue,
    afterHours: afterHoursSpans(points, windows, 60, tz) as unknown as Prisma.InputJsonValue,
    offRoute: (line.success ? offRouteSpans(points, line.data, windows, 500, tz) : []) as unknown as Prisma.InputJsonValue,
    stopVisits: visits as unknown as Prisma.InputJsonValue,
    trips: trips.map((t) => ({ label: t.label, start: t.start, end: t.end, km: t.distanceKm })) as unknown as Prisma.InputJsonValue,
    computedAt: new Date(),
  };
  return db.busDay.upsert({
    where: { busId_date: { busId, date: dbDate(day) } },
    create: { schoolId, busId, date: dbDate(day), ...data },
    update: data,
  });
}

/** Buses with a tracker. */
export async function trackedBusIds(client: Tx, schoolId: string): Promise<string[]> {
  const devices = await client.gpsDevice.findMany({
    where: { schoolId, busId: { not: null }, externalVehicleId: { not: null } },
    select: { busId: true },
  });
  return devices.map((d) => d.busId!);
}

/** Make sure today's rows are fresh: recompute any older than 5 minutes. */
export async function freshenToday(schoolId: string) {
  const today = localDate();
  const ids = await trackedBusIds(db, schoolId);
  const rows = await db.busDay.findMany({ where: { busId: { in: ids }, date: dbDate(today) }, select: { busId: true, computedAt: true } });
  const stale = ids.filter((id) => {
    const row = rows.find((r) => r.busId === id);
    return !row || Date.now() - row.computedAt.getTime() > TODAY_FRESH_MS;
  });
  await Promise.all(stale.map((id) => computeBusDay(schoolId, id, today).catch(() => null)));
}

/** Compute every tracked bus for each day in a range, one day at a time. */
export async function rebuildDays(schoolId: string, from: string, to: string): Promise<{ days: number; rows: number; failed: number; errors: string[] }> {
  const ids = await trackedBusIds(db, schoolId);
  let days = 0;
  let rows = 0;
  let failed = 0;
  // The first few reasons, so a failed rebuild says why.
  const errors: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    days++;
    const done = await Promise.all(
      ids.map((id) =>
        computeBusDay(schoolId, id, day)
          // The vendor sometimes refuses a quick burst: one more try, a moment later.
          .catch(() => new Promise((r) => setTimeout(r, 1500)).then(() => computeBusDay(schoolId, id, day)))
          .then(Boolean)
          .catch((error: unknown) => {
            if (errors.length < 3) errors.push(`${day}: ${error instanceof Error ? error.message.slice(0, 300) : String(error)}`);
            return false;
          }),
      ),
    );
    rows += done.filter(Boolean).length;
    failed += done.filter((d) => !d).length;
  }
  return { days, rows, failed, errors };
}

/** Nightly: yesterday for every school, and drop rows past the keep period. */
export async function nightly(schoolId: string) {
  const yesterday = addDays(localDate(), -1);
  const result = await rebuildDays(schoolId, yesterday, yesterday);
  await db.busDay.deleteMany({ where: { schoolId, date: { lt: dbDate(addDays(localDate(), -KEEP_DAYS)) } } });
  return result;
}

export const rebuildSchema = z.object({ days: z.number().int().min(1).max(60).default(30) });

/** Super admin: backfill the last N days (yesterday back), audited. */
export async function rebuild(ctx: Ctx, input: z.infer<typeof rebuildSchema>) {
  const to = addDays(localDate(), -1);
  const from = addDays(to, -(input.days - 1));
  const result = await rebuildDays(ctx.schoolId, from, to);
  ctx.audit({ action: "REBUILD_FLEET_DAYS", meta: { from, to, ...result } });
  return { from, to, ...result };
}
