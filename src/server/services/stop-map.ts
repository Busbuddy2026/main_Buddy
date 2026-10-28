import "server-only";
import { z } from "zod";
import type { Ctx } from "@/server/http/handler";
import { db } from "@/server/db";
import { conflict, invalid, notFound } from "@/server/http/errors";
import { clock } from "@/lib/api/schemas/masters";
import { addDays, formatTime, localDate } from "@/lib/time";
import { distanceM } from "@/lib/geo";
import { findPauses, nearestPoint, splitTrips, tripPath } from "@/lib/trips";
import { boxAround, findPlace } from "@/server/vendors/nominatim";
import { hasActiveTrip } from "@/server/services/masters/mutations";
import { loadDay, trackerFor } from "@/server/services/telematics";
import type { BusTrip, StopMapData, StopMapStop, StopMapTrip, StopSuggestion } from "@/lib/api/types";

/**
 * Mapping a route's stops from a bus's real trip: the day's trips with every
 * pause, the route's stops (those on it, and those its students board at),
 * suggested pins from OpenStreetMap snapped onto the trip, and saving the
 * confirmed pins, order and times. Every pin is confirmed by an admin.
 */

/** A suggestion further than this from the trip is somewhere else with the same name. */
const SNAP_M = 1500;
const MAX_TRACK_POINTS = 1500;

async function routeOf(ctx: Ctx, routeId: string) {
  const route = await ctx.db.route.findFirst({
    where: { id: routeId, schoolId: ctx.schoolId, deletedAt: null },
    include: { stops: { include: { stop: true }, orderBy: { sequence: "asc" } }, buses: { where: { deletedAt: null }, select: { id: true } } },
  });
  if (!route) throw notFound("Route");
  return route;
}

/** The route's stops, then those its students board at that are not on it yet. */
async function stopsOf(ctx: Ctx, route: Awaited<ReturnType<typeof routeOf>>): Promise<StopMapStop[]> {
  const riders = await ctx.db.student.groupBy({
    by: ["stopId"],
    where: { schoolId: ctx.schoolId, deletedAt: null, routeId: route.id, stopId: { not: null } },
    _count: { _all: true },
  });
  const count = new Map(riders.map((r) => [r.stopId!, r._count._all]));
  const onRoute = new Set(route.stops.map((rs) => rs.stopId));
  const others = await ctx.db.stop.findMany({
    where: { schoolId: ctx.schoolId, deletedAt: null, id: { in: [...count.keys()].filter((id) => !onRoute.has(id)) } },
    orderBy: { name: "asc" },
  });
  return [
    ...route.stops
      .filter((rs) => !rs.stop.deletedAt)
      .map((rs) => ({ id: rs.stop.id, name: rs.stop.name, students: count.get(rs.stop.id) ?? 0, lat: rs.stop.lat, lng: rs.stop.lng, seq: rs.sequence, pickup: rs.pickupTime, drop: rs.dropTime })),
    ...others.map((s) => ({ id: s.id, name: s.name, students: count.get(s.id) ?? 0, lat: s.lat, lng: s.lng, seq: null, pickup: null, drop: null })),
  ];
}

/** Buses with a linked tracker, the route's own first. */
async function trackedBuses(ctx: Ctx, preferred: string[]) {
  const devices = await ctx.db.gpsDevice.findMany({
    where: { schoolId: ctx.schoolId, busId: { not: null }, externalVehicleId: { not: null } },
    select: { busId: true },
  });
  const buses = await ctx.db.bus.findMany({
    where: { schoolId: ctx.schoolId, deletedAt: null, id: { in: devices.map((d) => d.busId!) } },
    select: { id: true, number: true },
    orderBy: { number: "asc" },
  });
  return buses.sort((a, b) => Number(preferred.includes(b.id)) - Number(preferred.includes(a.id)));
}

async function dayTripsWithTracks(ctx: Ctx, busId: string, day: string): Promise<{ trips: BusTrip[]; tracks: StopMapTrip[] }> {
  const { vehicleId } = await trackerFor(ctx.db, ctx.schoolId, busId);
  const { report, points } = await loadDay(ctx.schoolId, vehicleId, day);
  const trips = report ? splitTrips(report.timeline, report.stops, points) : [];
  const tracks = trips.map((t) => {
    const from = Date.parse(t.start);
    const to = t.end ? Date.parse(t.end) : Date.now();
    const inside = points.filter((p) => {
      const at = Date.parse(p.at);
      return at >= from && at <= to;
    });
    const step = Math.max(1, Math.ceil(inside.length / MAX_TRACK_POINTS));
    return {
      key: t.key,
      label: t.label,
      start: t.start,
      end: t.end,
      points: inside.filter((_, i) => i % step === 0 || i === inside.length - 1).map((p) => ({ lat: p.lat, lng: p.lng, at: p.at })),
      pauses: findPauses(points, from, to),
    };
  });
  return { trips, tracks };
}

export async function stopMapData(ctx: Ctx, routeId: string, busId: string | undefined, day: string): Promise<StopMapData> {
  const route = await routeOf(ctx, routeId);
  const buses = await trackedBuses(ctx, route.buses.map((b) => b.id));
  const bus = busId ? buses.find((b) => b.id === busId) : buses[0];
  if (busId && !bus) throw notFound("Bus with a tracker");
  const { tracks } = bus ? await dayTripsWithTracks(ctx, bus.id, day) : { tracks: [] };
  return {
    route: { id: route.id, name: route.name },
    busId: bus?.id ?? null,
    buses,
    date: day,
    trips: tracks,
    stops: await stopsOf(ctx, route),
  };
}

export const suggestQuery = z.object({
  bus: z.string().min(1).max(40),
  date: z.iso.date(),
  trip: z.string().min(1).max(4),
});

/**
 * A suggested pin for each unpinned stop: its name looked up on OpenStreetMap
 * near the trip, then moved to the nearest pause (where the bus actually
 * stopped), or else onto the road, if either is within 1.5 km.
 */
export async function suggestStops(ctx: Ctx, routeId: string, q: z.infer<typeof suggestQuery>): Promise<StopSuggestion[]> {
  const route = await routeOf(ctx, routeId);
  const stops = (await stopsOf(ctx, route)).filter((s) => s.lat == null || s.lng == null);
  const { tracks } = await dayTripsWithTracks(ctx, q.bus, q.date);
  const trip = tracks.find((t) => t.key === q.trip);
  const box = trip ? boxAround(trip.points) : null;
  if (!trip || !box) return [];

  const out: StopSuggestion[] = [];
  for (const stop of stops) {
    // "Krishnapuram Malampettai" may only be on the map as "Krishnapuram".
    const words = stop.name.split(/\s+/);
    const place = (await findPlace(stop.name, box)) ?? (words.length > 1 ? await findPlace(words[0]!, box) : null);
    if (!place) continue;
    const pause = trip.pauses
      .map((p) => ({ p, m: distanceM(p, place) }))
      .filter((x) => x.m <= SNAP_M)
      .sort((a, b) => b.p.durationS / (1 + b.m / 200) - a.p.durationS / (1 + a.m / 200))[0];
    if (pause) {
      const mins = Math.max(1, Math.round(pause.p.durationS / 60));
      out.push({ stopId: stop.id, lat: pause.p.lat, lng: pause.p.lng, source: `OpenStreetMap ${place.kind} · bus paused ${mins} min at ${formatTime(new Date(pause.p.start))}` });
      continue;
    }
    const road = nearestPoint(trip.points, place);
    if (road && road.metres <= SNAP_M) {
      out.push({ stopId: stop.id, lat: road.point.lat, lng: road.point.lng, source: `OpenStreetMap ${place.kind} · on the road at ${formatTime(new Date(road.point.at))}` });
    }
  }
  return out;
}

export const saveStopMapSchema = z.object({
  busId: z.string().min(1).max(40),
  date: z.iso.date(),
  /** The trip whose road becomes the route's line ("A"). */
  trip: z.string().min(1).max(4),
  stops: z
    .array(
      z.object({
        stopId: z.string().min(1).max(40),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        pickup: clock("pickup time"),
        drop: clock("drop time"),
      }),
    )
    .min(1, "Place at least one stop.")
    .max(60),
});

/**
 * Saves the confirmed pins, and puts those stops on the route in pickup-time
 * order with their times. The route takes the trip's road as its line, and
 * its length and duration. Stops already on the route but not placed here
 * keep their place after the placed ones.
 */
export async function saveStopMap(ctx: Ctx, routeId: string, input: z.infer<typeof saveStopMapSchema>) {
  const route = await routeOf(ctx, routeId);
  if (await hasActiveTrip(ctx.db, { routeId })) throw conflict("A bus is running this route right now. Map its stops after the trip ends.");
  const ids = input.stops.map((s) => s.stopId);
  if (new Set(ids).size !== ids.length) throw invalid("A stop is placed twice.");
  const owned = await ctx.db.stop.count({ where: { id: { in: ids }, schoolId: ctx.schoolId, deletedAt: null } });
  if (owned !== ids.length) throw invalid("Some stops no longer exist. Reload the page.");

  // The road comes from the tracker, not from the browser.
  const { trips } = await dayTripsWithTracks(ctx, input.busId, input.date);
  const trip = trips.find((t) => t.key === input.trip);
  if (!trip) throw invalid("That trip is not in the tracker's record for the day.");
  const { points } = await loadDay(ctx.schoolId, (await trackerFor(ctx.db, ctx.schoolId, input.busId)).vehicleId, input.date);
  const line = tripPath(points, Date.parse(trip.start), trip.end ? Date.parse(trip.end) : Date.now());

  const placed = [...input.stops].sort((a, b) => a.pickup.localeCompare(b.pickup));
  const kept = route.stops.filter((rs) => !ids.includes(rs.stopId) && !rs.stop.deletedAt);

  await db.$transaction(async (tx) => {
    for (const s of placed) await tx.stop.update({ where: { id: s.stopId }, data: { lat: s.lat, lng: s.lng } });
    await tx.routeStop.deleteMany({ where: { routeId } });
    const rows = [
      ...placed.map((s) => ({ stopId: s.stopId, pickupTime: s.pickup, dropTime: s.drop })),
      ...kept.map((rs) => ({ stopId: rs.stopId, pickupTime: rs.pickupTime, dropTime: rs.dropTime })),
    ];
    for (const [i, r] of rows.entries()) await tx.routeStop.create({ data: { routeId, sequence: i + 1, ...r } });
    await tx.route.update({
      where: { id: routeId },
      data: {
        geometry: line,
        distanceM: Math.round(trip.distanceKm * 1000),
        durationS: trip.durationS,
        status: "ACTIVE",
      },
    });
  });
  ctx.audit({
    action: "MAP_ROUTE_STOPS",
    entityType: "Route",
    entityId: routeId,
    meta: { stops: placed.length, busId: input.busId, date: input.date, trip: input.trip },
  });
  return stopMapData(ctx, routeId, input.busId, input.date);
}

/** Yesterday in the school's timezone: the default day to map from. */
export const yesterday = () => addDays(localDate(), -1);
