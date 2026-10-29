import "server-only";
import type { Tx } from "@/server/db";
import { loadDay, routePins } from "@/server/services/telematics";
import { splitTrips, stopVisits } from "@/lib/trips";
import { localMinute } from "@/lib/fleet-metrics";

/**
 * Today's run for one phase, from the bus's GPS tracker: the same trips the
 * admin console shows, and what the bus did at each pinned route stop. The
 * parent and crew apps read this so they agree with the console. Null when
 * the bus has no tracker.
 */

export interface GpsRun {
  trip: { start: string; end: string | null; running: boolean } | null;
  /** Stop id → when the bus stopped at or passed it on this run. */
  visits: Map<string, { status: "stopped" | "passed" | "missed"; at: string | null }>;
  /** Route stops with a map pin; only these can be judged from GPS. */
  pinned: Set<string>;
}

export async function gpsRun(
  db: Tx,
  schoolId: string,
  busId: string,
  day: string,
  tz: string,
  phase: "morning" | "evening",
  /** Prefer the run that served this stop, when several ran in the phase. */
  preferStopId?: string | null,
): Promise<GpsRun | null> {
  const device = await db.gpsDevice.findFirst({ where: { schoolId, busId, externalVehicleId: { not: null } }, select: { externalVehicleId: true } });
  if (!device?.externalVehicleId) return null;
  const [{ report, points }, pins] = await Promise.all([loadDay(schoolId, device.externalVehicleId, day), routePins(db, busId)]);
  const pinned = new Set(pins.map((p) => p.id));
  const trips = (report ? splitTrips(report.timeline, report.stops, points) : []).filter(
    (t) => (localMinute(t.start, tz) < 12 * 60) === (phase === "morning"),
  );
  if (!trips.length) return { trip: null, visits: new Map(), pinned };

  const judged = trips.map((t) => ({
    t,
    visits: pins.length ? stopVisits(points, pins, Date.parse(t.start), t.end ? Date.parse(t.end) : Date.now(), t.running) : [],
  }));
  const reached = (v: (typeof judged)[number]) => v.visits.filter((x) => x.at).length;
  // The running trip; else the one that served the preferred stop; else the one that served most stops.
  const pick =
    judged.find((j) => j.t.running) ??
    (preferStopId ? judged.find((j) => j.visits.some((v) => v.stopId === preferStopId && v.at)) : undefined) ??
    [...judged].sort((a, b) => reached(b) - reached(a))[0]!;
  return {
    trip: { start: pick.t.start, end: pick.t.end, running: pick.t.running },
    visits: new Map(pick.visits.map((v) => [v.stopId, { status: v.status, at: v.at }])),
    pinned,
  };
}
