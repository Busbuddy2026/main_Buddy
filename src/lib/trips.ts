import { distanceM } from "@/lib/geo";
import type { BusTrip, TripStop } from "@/lib/api/types";

/**
 * Cuts a bus's day into trips from the tracking vendor's timeline of MOVE and
 * STOP periods. A stop shorter than `TRIP_BREAK_S` is part of the trip (a
 * pickup, a signal); a longer one ends it (parked at school, parked for the
 * night). A trip still open at the end of the timeline is running.
 */

export const TRIP_BREAK_S = 30 * 60;
/** GPS jitter while parked: keep a point only once the bus has moved this far. */
const JITTER_M = 15;
const MAX_POINTS = 400;

export interface TimelinePeriod {
  type: string;
  start: string | null;
  end: string | null;
  address: string | null;
}

export interface VendorStop {
  start: string | null;
  address: string | null;
  at: { lat: number; lng: number } | null;
}

export interface TrackPoint {
  lat: number;
  lng: number;
  at: string;
}

const ms = (iso: string) => new Date(iso).getTime();

/** The track between two instants, without parked jitter, thinned for drawing. */
export function tripPath(points: TrackPoint[], from: number, to: number): Array<{ lat: number; lng: number }> {
  const moved: Array<{ lat: number; lng: number }> = [];
  for (const p of points) {
    const t = ms(p.at);
    if (t < from || t > to) continue;
    const last = moved[moved.length - 1];
    if (!last || distanceM(last, p) >= JITTER_M) moved.push({ lat: p.lat, lng: p.lng });
  }
  const step = Math.max(1, Math.ceil(moved.length / MAX_POINTS));
  return moved.filter((_, i) => i % step === 0 || i === moved.length - 1);
}

function pathKm(path: Array<{ lat: number; lng: number }>): number {
  let m = 0;
  for (let i = 1; i < path.length; i++) m += distanceM(path[i - 1]!, path[i]!);
  return Math.round(m / 100) / 10;
}

export function splitTrips(
  timeline: TimelinePeriod[],
  vendorStops: VendorStop[],
  points: TrackPoint[],
  now: Date = new Date(),
): BusTrip[] {
  const nowMs = now.getTime();
  const periods = timeline
    .filter((p): p is TimelinePeriod & { start: string } => !!p.start && ms(p.start) <= nowMs)
    .sort((a, b) => ms(a.start) - ms(b.start));

  const located = (start: string, address: string | null) => {
    const vendor = vendorStops.find((s) => s.start && ms(s.start) === ms(start));
    if (vendor?.at) return { lat: vendor.at.lat, lng: vendor.at.lng, address: vendor.address ?? address };
    // Fall back to the track point nearest the moment the bus stopped.
    let best: TrackPoint | null = null;
    for (const p of points) if (!best || Math.abs(ms(p.at) - ms(start)) < Math.abs(ms(best.at) - ms(start))) best = p;
    return { lat: best?.lat ?? null, lng: best?.lng ?? null, address: vendor?.address ?? address };
  };

  interface Open {
    start: string;
    end: string;
    from: string | null;
    stops: TripStop[];
    pending: TripStop | null;
  }
  const done: Array<Omit<Open, "pending"> & { to: string | null; running: boolean }> = [];
  let open: Open | null = null;
  let lastStopAddress: string | null = null;

  for (const p of periods) {
    const end = p.end && ms(p.end) < nowMs ? p.end : null;
    if (p.type === "MOVE") {
      if (!open) open = { start: p.start, end: end ?? now.toISOString(), from: lastStopAddress, stops: [], pending: null };
      else {
        if (open.pending) open.stops.push(open.pending);
        open.pending = null;
        open.end = end ?? now.toISOString();
      }
      continue;
    }
    // A stop.
    const stoppedS = ((end ? ms(end) : nowMs) - ms(p.start)) / 1000;
    const where = located(p.start, p.address);
    if (open) {
      if (stoppedS < TRIP_BREAK_S) {
        open.pending = { start: p.start, end, durationS: Math.round(stoppedS), address: where.address, lat: where.lat, lng: where.lng };
      } else {
        done.push({ start: open.start, end: p.start, from: open.from, stops: open.stops, to: where.address, running: false });
        open = null;
      }
    }
    lastStopAddress = where.address;
  }

  // Still open at the end of the timeline: driving, or at a stop that has not yet lasted long enough to end it.
  if (open) {
    if (open.pending) open.stops.push(open.pending);
    done.push({ start: open.start, end: open.end, from: open.from, stops: open.stops, to: null, running: true });
  }

  return done.map((t, i) => {
    const endMs = t.running ? nowMs : ms(t.end);
    const path = tripPath(points, ms(t.start), endMs);
    const key = String.fromCharCode(65 + (i % 26));
    return {
      key,
      label: `Trip ${key}`,
      running: t.running,
      start: t.start,
      end: t.running ? null : t.end,
      durationS: Math.round((endMs - ms(t.start)) / 1000),
      distanceKm: pathKm(path),
      from: t.from,
      to: t.to,
      stops: t.stops,
      points: path,
    };
  });
}
