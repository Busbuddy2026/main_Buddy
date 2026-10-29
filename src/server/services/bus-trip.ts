import "server-only";
import { z } from "zod";
import type { Ctx } from "@/server/http/handler";
import { readSettings } from "@/lib/api/schemas/settings";
import { addDays, dbDate, localDate } from "@/lib/time";
import { stopVisits } from "@/lib/trips";
import { driverScore, engineOnSeconds, estimateFuel, idleSeconds, localMinute, overspeedPoints } from "@/lib/fleet-metrics";
import { computeBusDay } from "@/server/services/fleet-day";
import { analyticsUnlocked } from "@/server/auth/analytics-lock";
import { alertFeed, dayTrips, loadDay, routePins, trackerFor } from "@/server/services/telematics";
import type { BusTripDetail } from "@/lib/api/types";

/**
 * One bus's chosen trip, for the live map's bus panel: the day's trips (to
 * pick from), what the bus did at each stop and which children boarded there,
 * the alerts raised during the trip, and, only with Analytics unlocked, the
 * trip's efficiency and the bus's last 30 days.
 */

export const tripQuery = z.object({
  date: z.iso.date().optional(),
  /** Trip letter; default the latest trip of the day. */
  trip: z.string().max(4).optional(),
});

const MARK_LABEL = { BOARDED: "Boarded", DROPPED: "Dropped", ABSENT: "Absent" } as const;

export async function busTripDetail(ctx: Ctx, busId: string, q: z.infer<typeof tripQuery>): Promise<BusTripDetail> {
  const day = q.date ?? localDate();
  const { bus, device, vehicleId } = await trackerFor(ctx.db, ctx.schoolId, busId);
  const [{ trips }, loaded, pins, school, unlocked] = await Promise.all([
    dayTrips(ctx, bus.id, day),
    loadDay(ctx.schoolId, vehicleId, day),
    routePins(ctx.db, bus.id),
    ctx.db.school.findUniqueOrThrow({ where: { id: ctx.schoolId }, select: { settings: true, timezone: true } }),
    analyticsUnlocked(),
  ]);
  const settings = readSettings(school.settings);
  const tz = school.timezone;
  const trip = (q.trip ? trips.find((t) => t.key === q.trip) : undefined) ?? trips[trips.length - 1] ?? null;
  const picker = trips.map((t) => ({ key: t.key, label: t.label, start: t.start, end: t.end, running: t.running, distanceKm: t.distanceKm }));
  if (!trip) return { date: day, trips: picker, trip: null, stops: [], alerts: [], efficiency: null, history: null, locked: !unlocked };

  const from = Date.parse(trip.start);
  const to = trip.end ? Date.parse(trip.end) : Date.now();
  const window = loaded.points.filter((p) => {
    const t = Date.parse(p.at);
    return t >= from && t <= to;
  });

  // Children per stop, with their mark for this run (morning trips are the BOARD phase).
  const phase = localMinute(trip.start, tz) < 12 * 60 ? "MORNING" : "EVENING";
  const [students, attendance] = await Promise.all([
    ctx.db.student.findMany({ where: { schoolId: ctx.schoolId, busId: bus.id, deletedAt: null }, select: { id: true, name: true, grade: true, section: true, stopId: true }, orderBy: { name: "asc" } }),
    ctx.db.trip.findUnique({ where: { busId_date_phase: { busId: bus.id, date: dbDate(day), phase } }, include: { marks: { where: { undone: false } } } }),
  ]);
  const markFor = (studentId: string): "Boarded" | "Dropped" | "Absent" | "Not marked" => {
    const marks = attendance?.marks.filter((m) => m.studentId === studentId) ?? [];
    const drop = marks.find((m) => m.phase === "DROP");
    const board = marks.find((m) => m.phase === "BOARD");
    const m = phase === "EVENING" && drop ? drop : board;
    return m ? MARK_LABEL[m.status] : "Not marked";
  };
  const visits = stopVisits(loaded.points, pins, from, to, trip.running);
  const visitOf = new Map(visits.map((v) => [v.stopId, v]));
  // Evening runs drive the route backwards.
  const ordered = phase === "EVENING" ? [...pins].reverse() : pins;
  const stops = ordered.map((p) => {
    const v = visitOf.get(p.id);
    return {
      stopId: p.id,
      name: p.name,
      seq: p.seq,
      status: v?.status ?? ("pending" as const),
      at: v?.at ?? null,
      dwellS: v?.dwellS ?? 0,
      students: students.filter((s) => s.stopId === p.id).map((s) => ({ id: s.id, name: s.name, cls: `${s.grade} · ${s.section}`, mark: markFor(s.id) })),
    };
  });

  const feed = await alertFeed(ctx, bus.id, { from: day, to: day });
  const alerts = feed.items.filter((a) => {
    const t = Date.parse(a.at);
    return t >= from && t <= to;
  });

  if (!unlocked) return { date: day, trips: picker, trip, stops, alerts, efficiency: null, history: null, locked: true };

  // Efficiency for this trip: from the track inside the trip's time.
  const idleS = idleSeconds(window);
  const engineOnS = engineOnSeconds(window);
  const fuel = estimateFuel({ km: trip.distanceKm, idleS, mileageKmpl: bus.mileageKmpl, idleLph: bus.idleLph, dieselPriceRs: settings.dieselPriceRs });
  const moving = window.filter((p) => p.speed > 5);
  const efficiency = {
    km: trip.distanceKm,
    durationS: trip.durationS,
    engineOnS,
    idleS,
    fuelL: fuel.litres,
    costRs: fuel.costRs,
    idleCostRs: fuel.idleCostRs,
    kmpl: fuel.litres ? Math.round((trip.distanceKm / fuel.litres) * 10) / 10 : null,
    maxSpeed: Math.round(Math.max(0, ...window.map((p) => p.speed))),
    avgMovingSpeed: moving.length ? Math.round(moving.reduce((n, p) => n + p.speed, 0) / moving.length) : 0,
    overspeedCount: overspeedPoints(window, device.speedLimit ?? 60).length,
    speedLimit: device.speedLimit ?? 60,
    stopsServed: visits.filter((v) => v.status === "stopped").length,
    stopsMissed: visits.filter((v) => v.status !== "stopped").length,
    /** Stops a running trip has not reached yet. */
    stopsAhead: Math.max(0, pins.length - visits.length),
    mileageKmpl: bus.mileageKmpl,
  };

  // Today counts too: bring this bus's saved day up to date (at most every 5 minutes).
  const todayRow = await ctx.db.busDay.findUnique({ where: { busId_date: { busId: bus.id, date: dbDate(localDate()) } }, select: { computedAt: true } });
  if (!todayRow || Date.now() - todayRow.computedAt.getTime() > 5 * 60_000) await computeBusDay(ctx.schoolId, bus.id, localDate()).catch(() => null);

  // The bus's last 30 days, from the saved daily summaries.
  const rows = await ctx.db.busDay.findMany({ where: { busId: bus.id, date: { gte: dbDate(addDays(localDate(), -29)) } } });
  const driven = rows.filter((r) => r.distanceKm > 0);
  const sum = (k: "distanceKm" | "engineOnS" | "idleS" | "estFuelL" | "estCostRs" | "idleCostRs" | "overspeedCount") => rows.reduce((n, r) => n + r[k], 0);
  const bell = Number(settings.bellTime.slice(0, 2)) * 60 + Number(settings.bellTime.slice(3, 5));
  const arrivals = rows.filter((r) => r.schoolArrivalAt).map((r) => localMinute(r.schoolArrivalAt!.toISOString(), tz));
  const missed = rows.reduce((n, r) => n + (r.stopVisits as unknown as Array<{ status: string }>).filter((v) => v.status !== "stopped").length, 0);
  const history = {
    days: driven.length,
    km: Math.round(sum("distanceKm") * 10) / 10,
    engineOnS: sum("engineOnS"),
    idleS: sum("idleS"),
    idlePct: sum("engineOnS") ? Math.round((sum("idleS") / sum("engineOnS")) * 100) : 0,
    fuelL: Math.round(sum("estFuelL") * 10) / 10,
    costRs: sum("estCostRs"),
    idleCostRs: sum("idleCostRs"),
    overspeedEvents: sum("overspeedCount"),
    missedStops: missed,
    onTimePct: arrivals.length ? Math.round((arrivals.filter((m) => m <= bell).length / arrivals.length) * 100) : null,
    bellTime: settings.bellTime,
    schoolArrivals: arrivals.length,
    score: driverScore({
      days: driven.length,
      overspeedEvents: sum("overspeedCount"),
      harshEvents: 0,
      idleMin: Math.round(sum("idleS") / 60),
      missedStops: missed,
      afterHoursTrips: rows.reduce((n, r) => n + (r.afterHours as unknown as unknown[]).length, 0),
      offRouteSpans: rows.reduce((n, r) => n + (r.offRoute as unknown as unknown[]).length, 0),
    }),
  };
  return { date: day, trips: picker, trip, stops, alerts, efficiency, history, locked: false };
}
