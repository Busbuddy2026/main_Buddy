import "server-only";
import { z } from "zod";
import type { Ctx } from "@/server/http/handler";
import { readSettings } from "@/lib/api/schemas/settings";
import { addDays, dbDate, localDate } from "@/lib/time";
import { freshenToday, trackedBusIds, type IdleEvent } from "@/server/services/fleet-day";
import { db } from "@/server/db";
import { driverScore, hotspots, localMinute, localWeekday, median, type DriverTally, type SpeedPoint } from "@/lib/fleet-metrics";
import { notFound } from "@/server/http/errors";
import type { EfficiencyReport, FleetHealthReport, PunctualityReport, SafetyReport } from "@/lib/api/types";
import type { Tx } from "@/server/db";

/** Fleet efficiency over a range of days, from the saved BusDay rows. */

export const rangeQuery = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

/** Default: the last 7 days, today included. */
export function rangeOf(q: z.infer<typeof rangeQuery>) {
  const to = q.to ?? localDate();
  const from = q.from ?? addDays(to, -6);
  return from <= to ? { from, to } : { from: to, to: from };
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

export async function efficiency(ctx: Ctx, q: z.infer<typeof rangeQuery>): Promise<EfficiencyReport> {
  const { from, to } = rangeOf(q);
  if (to >= localDate()) await freshenToday(ctx.schoolId);
  const ids = await trackedBusIds(ctx.db, ctx.schoolId);
  const [school, buses, rows] = await Promise.all([
    ctx.db.school.findUniqueOrThrow({ where: { id: ctx.schoolId }, select: { settings: true } }),
    ctx.db.bus.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, number: true, mileageKmpl: true, idleLph: true, _count: { select: { students: { where: { deletedAt: null } } } } },
      orderBy: { number: "asc" },
    }),
    ctx.db.busDay.findMany({ where: { schoolId: ctx.schoolId, busId: { in: ids }, date: { gte: dbDate(from), lte: dbDate(to) } } }),
  ]);
  const settings = readSettings(school.settings);

  const perBus = buses.map((b) => {
    const mine = rows.filter((r) => r.busId === b.id);
    const sum = (k: "distanceKm" | "movingS" | "engineOnS" | "idleS" | "estFuelL" | "estCostRs" | "idleCostRs") => mine.reduce((n, r) => n + r[k], 0);
    const km = Math.round(sum("distanceKm") * 10) / 10;
    const fuelL = Math.round(sum("estFuelL") * 10) / 10;
    const costRs = sum("estCostRs");
    const engineOnS = sum("engineOnS");
    const idleS = sum("idleS");
    const trips = mine.reduce((n, r) => n + (Array.isArray(r.trips) ? r.trips.length : 0), 0);
    const riders = b._count.students;
    return {
      busId: b.id,
      number: b.number,
      days: mine.filter((r) => r.distanceKm > 0).length,
      km,
      movingS: sum("movingS"),
      engineOnS,
      idleS,
      idlePct: engineOnS ? Math.round((idleS / engineOnS) * 100) : 0,
      fuelL,
      costRs,
      idleCostRs: sum("idleCostRs"),
      kmpl: fuelL ? Math.round((km / fuelL) * 10) / 10 : null,
      costPerKm: km ? Math.round((costRs / km) * 10) / 10 : null,
      trips,
      costPerTrip: trips ? Math.round(costRs / trips) : null,
      riders,
      costPerChild: riders ? Math.round(costRs / riders) : null,
      mileageKmpl: b.mileageKmpl,
      idleLph: b.idleLph,
    };
  });

  const number = new Map(buses.map((b) => [b.id, b.number]));
  const idle = buses.length ? Object.fromEntries(buses.map((b) => [b.id, b.idleLph])) : {};
  const idleEvents = rows
    .flatMap((r) =>
      (r.idleEvents as unknown as IdleEvent[]).map((e) => ({
        bus: number.get(r.busId) ?? "?",
        ...e,
        costRs: Math.round((e.durationS / 3600) * (idle[r.busId] ?? 2.5) * settings.dieselPriceRs),
      })),
    )
    .sort((a, b) => b.durationS - a.durationS)
    .slice(0, 100);

  const total = (k: keyof (typeof perBus)[number]) => perBus.reduce((n, b) => n + (typeof b[k] === "number" ? (b[k] as number) : 0), 0);
  const engineOnS = total("engineOnS");
  const idleS = total("idleS");
  return {
    from,
    to,
    dieselPriceRs: settings.dieselPriceRs,
    coverage: { days: daysBetween(from, to), withData: new Set(rows.map((r) => r.date.toISOString().slice(0, 10))).size },
    totals: {
      km: Math.round(total("km") * 10) / 10,
      movingS: total("movingS"),
      engineOnS,
      idleS,
      idlePct: engineOnS ? Math.round((idleS / engineOnS) * 100) : 0,
      fuelL: Math.round(total("fuelL") * 10) / 10,
      costRs: total("costRs"),
      idleCostRs: total("idleCostRs"),
    },
    buses: perBus,
    idleEvents,
  };
}

// ── Driver safety ─────────────────────────────────────────────────────────

/** Vendor alert types that count as harsh or risky driving. */
const HARSH_TYPES = ["user_defined_alarm", "harsh_braking", "harsh_acceleration", "harsh_cornering", "collision_warning", "rollover_warning"];

interface StoredVisit {
  stopId: string;
  trip: string;
  status: "stopped" | "passed" | "missed";
  at: string | null;
}

export async function safety(ctx: Ctx, q: z.infer<typeof rangeQuery>): Promise<SafetyReport> {
  const { from, to } = rangeOf(q);
  if (to >= localDate()) await freshenToday(ctx.schoolId);
  const [rows, drivers, buses, events] = await Promise.all([
    ctx.db.busDay.findMany({ where: { schoolId: ctx.schoolId, date: { gte: dbDate(from), lte: dbDate(to) } } }),
    ctx.db.crew.findMany({ where: { schoolId: ctx.schoolId, role: "DRIVER", deletedAt: null }, select: { id: true, name: true, drivingBuses: { select: { number: true } } } }),
    ctx.db.bus.findMany({ where: { schoolId: ctx.schoolId }, select: { id: true, number: true } }),
    ctx.db.trackerEvent.findMany({
      where: { schoolId: ctx.schoolId, type: { in: HARSH_TYPES }, at: { gte: new Date(`${from}T00:00:00+05:30`), lt: new Date(`${addDays(to, 1)}T00:00:00+05:30`) } },
      select: { busId: true, at: true },
    }),
  ]);
  const number = new Map(buses.map((b) => [b.id, b.number]));
  const dayOf = (d: Date) => localDate(d);
  const harshOn = (busId: string, day: string) => events.filter((e) => e.busId === busId && dayOf(e.at) === day).length;

  const tallies = new Map<string, DriverTally & { km: number; overspeedKm: number; buses: Set<string> }>();
  for (const r of rows) {
    const key = r.driverId ?? "";
    const t = tallies.get(key) ?? { days: 0, overspeedEvents: 0, harshEvents: 0, idleMin: 0, missedStops: 0, afterHoursTrips: 0, offRouteSpans: 0, km: 0, overspeedKm: 0, buses: new Set<string>() };
    const day = r.date.toISOString().slice(0, 10);
    if (r.distanceKm > 0) t.days++;
    t.km += r.distanceKm;
    t.overspeedEvents += r.overspeedCount;
    t.overspeedKm += r.overspeedKm;
    t.harshEvents += harshOn(r.busId, day);
    t.idleMin += Math.round(r.idleS / 60);
    t.missedStops += (r.stopVisits as unknown as StoredVisit[]).filter((v) => v.status !== "stopped").length;
    t.afterHoursTrips += (r.afterHours as unknown as unknown[]).length;
    t.offRouteSpans += (r.offRoute as unknown as unknown[]).length;
    t.buses.add(number.get(r.busId) ?? "?");
    tallies.set(key, t);
  }

  const people = new Map(drivers.map((d) => [d.id, d]));
  const driverRows = [...tallies.entries()].map(([id, t]) => ({
    driverId: id || null,
    name: id ? (people.get(id)?.name ?? "Former driver") : "No driver assigned",
    buses: [...t.buses].sort(),
    days: t.days,
    km: Math.round(t.km * 10) / 10,
    overspeedEvents: t.overspeedEvents,
    overspeedKm: Math.round(t.overspeedKm * 10) / 10,
    harshEvents: t.harshEvents,
    idleMin: t.idleMin,
    missedStops: t.missedStops,
    afterHours: t.afterHoursTrips,
    offRoute: t.offRouteSpans,
    score: driverScore(t),
  }));
  // Drivers with no days in the period still show, with a clean slate.
  for (const d of drivers) {
    if (!tallies.has(d.id)) {
      driverRows.push({ driverId: d.id, name: d.name, buses: d.drivingBuses.map((b) => b.number), days: 0, km: 0, overspeedEvents: 0, overspeedKm: 0, harshEvents: 0, idleMin: 0, missedStops: 0, afterHours: 0, offRoute: 0, score: 100 });
    }
  }
  driverRows.sort((a, b) => a.score - b.score || b.days - a.days);

  const points = rows.flatMap((r) => r.overspeedPoints as unknown as SpeedPoint[]);
  const spans = <T extends { start: string; end: string }>(k: "afterHours" | "offRoute") =>
    rows
      .flatMap((r) => (r[k] as unknown as T[]).map((s) => ({ bus: number.get(r.busId) ?? "?", driver: r.driverId ? (people.get(r.driverId)?.name ?? null) : null, ...s })))
      .sort((a, b) => b.start.localeCompare(a.start));

  return {
    from,
    to,
    coverage: { days: daysBetween(from, to), withData: new Set(rows.map((r) => r.date.toISOString().slice(0, 10))).size },
    drivers: driverRows,
    hotspots: hotspots(points).slice(0, 40),
    afterHours: spans<{ start: string; end: string; km: number }>("afterHours"),
    offRoute: spans<{ start: string; end: string; maxM: number }>("offRoute"),
  };
}

/** Nightly: each driver's score over the last 30 days, onto Crew.safetyScore. */
export async function refreshDriverScores(schoolId: string) {
  const to = localDate();
  const from = addDays(to, -29);
  const rows = await db.busDay.findMany({ where: { schoolId, driverId: { not: null }, date: { gte: dbDate(from), lte: dbDate(to) } } });
  const by = new Map<string, DriverTally>();
  for (const r of rows) {
    const t = by.get(r.driverId!) ?? { days: 0, overspeedEvents: 0, harshEvents: 0, idleMin: 0, missedStops: 0, afterHoursTrips: 0, offRouteSpans: 0 };
    if (r.distanceKm > 0) t.days++;
    t.overspeedEvents += r.overspeedCount;
    t.idleMin += Math.round(r.idleS / 60);
    t.missedStops += (r.stopVisits as unknown as StoredVisit[]).filter((v) => v.status !== "stopped").length;
    t.afterHoursTrips += (r.afterHours as unknown as unknown[]).length;
    t.offRouteSpans += (r.offRoute as unknown as unknown[]).length;
    by.set(r.driverId!, t);
  }
  for (const [id, t] of by) await db.crew.update({ where: { id }, data: { safetyScore: driverScore(t) } }).catch(() => undefined);
}

// ── Punctuality ───────────────────────────────────────────────────────────

const minutesToClock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
const clockToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/**
 * The usual time the bus reaches each stop, morning and evening: the median of
 * the last 20 days it stopped or passed there. Morning is the day's first trip,
 * evening its last.
 */
export async function typicalStopTimes(client: Tx, busIds: string[], tz = "Asia/Kolkata", days = 20) {
  const rows = await client.busDay.findMany({
    where: { busId: { in: busIds }, date: { gte: dbDate(addDays(localDate(), -days)) } },
    select: { busId: true, stopVisits: true, trips: true },
  });
  const samples = new Map<string, { morning: number[]; evening: number[] }>();
  for (const r of rows) {
    const trips = r.trips as unknown as Array<{ label: string }>;
    if (!trips.length) continue;
    const first = trips[0]!.label.replace("Trip ", "");
    const last = trips[trips.length - 1]!.label.replace("Trip ", "");
    for (const v of r.stopVisits as unknown as StoredVisit[]) {
      if (!v.at || v.status === "missed") continue;
      const s = samples.get(v.stopId) ?? { morning: [], evening: [] };
      if (v.trip === first) s.morning.push(localMinute(v.at, tz));
      else if (v.trip === last) s.evening.push(localMinute(v.at, tz));
      samples.set(v.stopId, s);
    }
  }
  return new Map(
    [...samples.entries()].map(([stopId, s]) => {
      const m = median(s.morning);
      const e = median(s.evening);
      return [stopId, { morning: m == null ? null : minutesToClock(m), evening: e == null ? null : minutesToClock(e), samples: Math.max(s.morning.length, s.evening.length) }];
    }),
  );
}

export async function punctuality(ctx: Ctx, q: z.infer<typeof rangeQuery>): Promise<PunctualityReport> {
  const { from, to } = rangeOf(q);
  if (to >= localDate()) await freshenToday(ctx.schoolId);
  const ids = await trackedBusIds(ctx.db, ctx.schoolId);
  const [school, buses, rows] = await Promise.all([
    ctx.db.school.findUniqueOrThrow({ where: { id: ctx.schoolId }, select: { settings: true, timezone: true } }),
    ctx.db.bus.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        number: true,
        route: { select: { name: true, stops: { orderBy: { sequence: "asc" }, select: { stopId: true, sequence: true, pickupTime: true, dropTime: true, stop: { select: { name: true } } } } } },
        students: { where: { deletedAt: null }, select: { id: true, name: true, grade: true, section: true, stopId: true } },
      },
      orderBy: { number: "asc" },
    }),
    ctx.db.busDay.findMany({ where: { schoolId: ctx.schoolId, busId: { in: ids }, date: { gte: dbDate(from), lte: dbDate(to) } }, orderBy: { date: "asc" } }),
  ]);
  const settings = readSettings(school.settings);
  const tz = school.timezone;
  const bell = clockToMinutes(settings.bellTime);
  const typical = await typicalStopTimes(ctx.db, ids, tz);

  const perBus = buses.map((b) => {
    const days = rows.filter((r) => r.busId === b.id && r.schoolArrivalAt);
    const arrivals = days.map((r) => ({ date: r.date.toISOString().slice(0, 10), minute: localMinute(r.schoolArrivalAt!.toISOString(), tz) }));
    const late = arrivals.map((a) => a.minute - bell);
    const onTime = late.filter((m) => m <= 0).length;
    const firstStop = b.route?.stops[0];
    const firstActual = firstStop ? typical.get(firstStop.stopId)?.morning ?? null : null;
    return {
      busId: b.id,
      number: b.number,
      route: b.route?.name ?? null,
      days: arrivals.length,
      onTimeDays: onTime,
      onTimePct: arrivals.length ? Math.round((onTime / arrivals.length) * 100) : null,
      avgLateMin: late.length ? Math.round(late.reduce((n, m) => n + m, 0) / late.length) : null,
      typicalArrival: arrivals.length ? minutesToClock(median(arrivals.map((a) => a.minute))!) : null,
      latest: arrivals
        .map((a) => ({ date: a.date, arrival: minutesToClock(a.minute), lateMin: a.minute - bell }))
        .filter((a) => a.lateMin > 0)
        .sort((x, y) => y.lateMin - x.lateMin)
        .slice(0, 5),
      firstStop: firstStop ? { name: firstStop.stop.name, scheduled: firstStop.pickupTime, usual: firstActual } : null,
    };
  });

  const stops = buses.flatMap((b) =>
    (b.route?.stops ?? []).map((rs) => {
      const t = typical.get(rs.stopId);
      return {
        stopId: rs.stopId,
        name: rs.stop.name,
        bus: b.number,
        seq: rs.sequence,
        scheduledPickup: rs.pickupTime,
        scheduledDrop: rs.dropTime,
        usualPickup: t?.morning ?? null,
        usualDrop: t?.evening ?? null,
        samples: t?.samples ?? 0,
      };
    }),
  );

  // Ride length: from the child's stop to school (morning), and school to the stop (evening).
  const rides = buses.flatMap((b) => {
    const school = perBus.find((p) => p.busId === b.id)?.typicalArrival;
    const leave = rows.filter((r) => r.busId === b.id).map((r) => (r.trips as unknown as Array<{ start: string }>).at(-1)?.start).filter((s): s is string => !!s);
    const leaveMin = median(leave.map((s) => localMinute(s, tz)));
    return b.students
      .filter((s) => s.stopId)
      .map((s) => {
        const t = typical.get(s.stopId!);
        const morning = school && t?.morning ? clockToMinutes(school) - clockToMinutes(t.morning) : null;
        const evening = leaveMin != null && t?.evening ? clockToMinutes(t.evening) - leaveMin : null;
        const stop = b.route?.stops.find((x) => x.stopId === s.stopId)?.stop.name ?? null;
        return {
          studentId: s.id,
          name: s.name,
          cls: `${s.grade} · ${s.section}`,
          bus: b.number,
          stop,
          morningMin: morning != null && morning > 0 ? morning : null,
          eveningMin: evening != null && evening > 0 ? evening : null,
        };
      })
      .filter((r) => r.morningMin != null || r.eveningMin != null);
  });
  rides.sort((a, b) => Math.max(b.morningMin ?? 0, b.eveningMin ?? 0) - Math.max(a.morningMin ?? 0, a.eveningMin ?? 0));

  return {
    from,
    to,
    bellTime: settings.bellTime,
    maxRideMin: settings.maxRideMin,
    coverage: { days: daysBetween(from, to), withData: new Set(rows.map((r) => r.date.toISOString().slice(0, 10))).size },
    buses: perBus,
    stops,
    rides,
  };
}

// ── Fleet health ──────────────────────────────────────────────────────────

const HEALTH_DAYS = 30;

/** School days in a range: every day but Sunday. */
function schoolDays(from: string, to: string, tz: string): number {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (localWeekday(`${d}T06:30:00.000Z`, tz) !== 0) n++;
  return n;
}

export async function fleetHealth(ctx: Ctx): Promise<FleetHealthReport> {
  const to = localDate();
  const from = addDays(to, -(HEALTH_DAYS - 1));
  await freshenToday(ctx.schoolId);
  const ids = await trackedBusIds(ctx.db, ctx.schoolId);
  const [school, buses, recent] = await Promise.all([
    ctx.db.school.findUniqueOrThrow({ where: { id: ctx.schoolId }, select: { timezone: true } }),
    ctx.db.bus.findMany({
      where: { schoolId: ctx.schoolId, deletedAt: null },
      select: {
        id: true,
        number: true,
        capacity: true,
        serviceEveryKm: true,
        lastServiceOn: true,
        routeId: true,
        route: { select: { id: true, name: true, stops: { orderBy: { sequence: "asc" }, select: { stopId: true, sequence: true, stop: { select: { name: true } } } } } },
        _count: { select: { students: { where: { deletedAt: null } } } },
      },
      orderBy: { number: "asc" },
    }),
    ctx.db.busDay.findMany({ where: { schoolId: ctx.schoolId, date: { gte: dbDate(from), lte: dbDate(to) } } }),
  ]);
  const tz = school.timezone;
  const open = schoolDays(from, to, tz);

  // km since each bus's last service: every saved day after it.
  const sinceService = await Promise.all(
    buses.map(async (b) =>
      b.lastServiceOn
        ? (await ctx.db.busDay.aggregate({ where: { busId: b.id, date: { gt: b.lastServiceOn } }, _sum: { distanceKm: true } }))._sum.distanceKm ?? 0
        : null,
    ),
  );

  const usage = buses.map((b, i) => {
    const days = recent.filter((r) => r.busId === b.id && r.distanceKm > 0);
    const km = days.reduce((n, r) => n + r.distanceKm, 0);
    const engineS = days.reduce((n, r) => n + r.engineOnS, 0);
    const riders = b._count.students;
    const fillPct = b.capacity ? Math.round((riders / b.capacity) * 100) : 0;
    const usedPct = open ? Math.round((days.length / open) * 100) : 0;
    const since = sinceService[i];
    const service =
      since == null
        ? { state: "unknown" as const, kmSince: null, dueInKm: null }
        : since >= b.serviceEveryKm
          ? { state: "overdue" as const, kmSince: Math.round(since), dueInKm: Math.round(b.serviceEveryKm - since) }
          : since >= b.serviceEveryKm * 0.9
            ? { state: "due-soon" as const, kmSince: Math.round(since), dueInKm: Math.round(b.serviceEveryKm - since) }
            : { state: "ok" as const, kmSince: Math.round(since), dueInKm: Math.round(b.serviceEveryKm - since) };
    return {
      busId: b.id,
      number: b.number,
      tracked: ids.includes(b.id),
      riders,
      capacity: b.capacity,
      fillPct,
      daysUsed: days.length,
      openDays: open,
      usedPct,
      kmPerDay: days.length ? Math.round((km / days.length) * 10) / 10 : 0,
      engineHoursPerDay: days.length ? Math.round((engineS / days.length / 3600) * 10) / 10 : 0,
      underused: ids.includes(b.id) && (fillPct < 50 || usedPct < 60),
      serviceEveryKm: b.serviceEveryKm,
      lastServiceOn: b.lastServiceOn ? b.lastServiceOn.toISOString().slice(0, 10) : null,
      service,
    };
  });

  // Route suggestions, from how the bus actually runs.
  const typical = await typicalStopTimes(ctx.db, ids, tz);
  const riders = await ctx.db.student.groupBy({ by: ["stopId"], where: { schoolId: ctx.schoolId, deletedAt: null, stopId: { not: null } }, _count: { _all: true } });
  const ridersAt = new Map(riders.map((r) => [r.stopId!, r._count._all]));
  const suggestions: FleetHealthReport["suggestions"] = [];
  const seenRoutes = new Set<string>();
  for (const b of buses) {
    const route = b.route;
    if (!route || seenRoutes.has(route.id)) continue;
    seenRoutes.add(route.id);
    for (const rs of route.stops) {
      const n = ridersAt.get(rs.stopId) ?? 0;
      if (n <= 1) suggestions.push({ route: route.name, kind: "few-riders", text: `${rs.stop.name} has ${n === 0 ? "no children" : "one child"}. Could it merge with a nearby stop?` });
    }
    // Missed often: not stopped at on most recent morning runs.
    const mine = recent.filter((r) => r.busId === b.id);
    for (const rs of route.stops) {
      let runs = 0;
      let missed = 0;
      for (const r of mine) {
        const trips = r.trips as unknown as Array<{ label: string }>;
        const first = trips[0]?.label.replace("Trip ", "");
        const v = (r.stopVisits as unknown as StoredVisit[]).find((x) => x.stopId === rs.stopId && x.trip === first);
        if (!v) continue;
        runs++;
        if (v.status !== "stopped") missed++;
      }
      if (runs >= 3 && missed / runs > 0.5) suggestions.push({ route: route.name, kind: "often-skipped", text: `The bus did not stop at ${rs.stop.name} on ${missed} of ${runs} mornings. Check the pin, or whether children still board there.` });
    }
    // Order: the route's sequence against the order the bus really reaches the stops.
    const timed = route.stops.map((rs) => ({ ...rs, at: typical.get(rs.stopId)?.morning ?? null })).filter((x) => x.at);
    const byTime = [...timed].sort((x, y) => x.at!.localeCompare(y.at!));
    if (timed.length >= 3 && byTime.some((x, i) => x.stopId !== timed[i]!.stopId)) {
      suggestions.push({
        route: route.name,
        kind: "order",
        text: `The bus reaches the stops in a different order from the route's list. Usual order: ${byTime.map((x) => x.stop.name).join(" → ")}.`,
      });
    }
  }

  return { from, to, usage, suggestions };
}

export const serviceSchema = z.object({ busId: z.string().min(1).max(40), on: z.iso.date().optional() });

/** "Mark serviced": the service clock starts again from that day. */
export async function markServiced(ctx: Ctx, input: z.infer<typeof serviceSchema>) {
  const bus = await ctx.db.bus.findFirst({ where: { id: input.busId, schoolId: ctx.schoolId, deletedAt: null } });
  if (!bus) throw notFound("Bus");
  const on = input.on ?? localDate();
  await ctx.db.bus.update({ where: { id: bus.id }, data: { lastServiceOn: dbDate(on) } });
  ctx.audit({ action: "BUS_SERVICED", entityType: "Bus", entityId: bus.id, meta: { on } });
  return { ok: true };
}
