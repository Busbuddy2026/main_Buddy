import { distanceM } from "@/lib/geo";

/**
 * The maths behind fleet analytics, from a bus's day of track points (about
 * one every 20 s, with speed and engine on/off). Pure and tested; the server
 * feeds it LivePin's track and saves the results per bus per day.
 */

export interface MetricPoint {
  lat: number;
  lng: number;
  speed: number;
  ignition: boolean | null;
  at: string;
}

/** Points are about 20 s apart: a lone point stands for that much time. */
const STEP_S = 20;
const STILL_KPH = 2;
const MOVING_KPH = 5;

const ms = (iso: string) => Date.parse(iso);

export interface IdleSpell {
  start: string;
  end: string;
  durationS: number;
  lat: number;
  lng: number;
}

/**
 * Engine on and standing still: spells of consecutive points with the
 * ignition on at walking pace or less, kept when they last `minS` or more.
 */
export function idleSpells(points: MetricPoint[], minS = 300): IdleSpell[] {
  const out: IdleSpell[] = [];
  let first: MetricPoint | null = null;
  let last: MetricPoint | null = null;
  const close = () => {
    if (first && last) {
      const durationS = Math.round((ms(last.at) - ms(first.at)) / 1000) + STEP_S;
      if (durationS >= minS) out.push({ start: first.at, end: last.at, durationS, lat: first.lat, lng: first.lng });
    }
    first = last = null;
  };
  for (const p of points) {
    if (p.ignition === true && p.speed <= STILL_KPH) {
      first ??= p;
      last = p;
    } else close();
  }
  close();
  return out;
}

/** All engine-on standing time in the day, short waits included. */
export function idleSeconds(points: MetricPoint[]): number {
  return idleSpells(points, 0).reduce((n, s) => n + s.durationS, 0);
}

export interface FuelInputs {
  km: number;
  idleS: number;
  /** The bus's rated mileage while driving. */
  mileageKmpl: number;
  /** What it burns standing with the engine on. */
  idleLph: number;
  dieselPriceRs: number;
}

/** An estimate, not a measurement: there is no fuel sensor. */
export function estimateFuel(f: FuelInputs): { litres: number; costRs: number; idleLitres: number; idleCostRs: number } {
  const drive = f.mileageKmpl > 0 ? f.km / f.mileageKmpl : 0;
  const idleLitres = (f.idleS / 3600) * f.idleLph;
  const litres = drive + idleLitres;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    litres: round1(litres),
    costRs: Math.round(litres * f.dieselPriceRs),
    idleLitres: round1(idleLitres),
    idleCostRs: Math.round(idleLitres * f.dieselPriceRs),
  };
}

export interface Window {
  /** "06:30" local. */
  start: string;
  end: string;
}

/** Minutes past local midnight in the school's timezone. */
export function localMinute(iso: string, tz = "Asia/Kolkata"): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** 0 Sunday … 6 Saturday, in the school's timezone. */
export function localWeekday(iso: string, tz = "Asia/Kolkata"): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(iso));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

const clockMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export interface Span {
  start: string;
  end: string;
  km: number;
}

/**
 * Driving outside school runs: moving (> 5 km/h) outside the morning and
 * evening windows widened by `padMin`, or at any time on a Sunday. Moves less
 * than 10 minutes apart are one span; spans under half a kilometre are left out.
 */
export function afterHoursSpans(points: MetricPoint[], windows: Window[], padMin = 60, tz = "Asia/Kolkata"): Span[] {
  const inside = (iso: string) => {
    if (localWeekday(iso, tz) === 0) return false;
    const m = localMinute(iso, tz);
    return windows.some((w) => m >= clockMin(w.start) - padMin && m <= clockMin(w.end) + padMin);
  };
  const out: Span[] = [];
  let cur: { start: MetricPoint; end: MetricPoint; m: number; prev: MetricPoint } | null = null;
  for (const p of points) {
    if (p.speed <= MOVING_KPH || inside(p.at)) continue;
    if (cur && ms(p.at) - ms(cur.end.at) <= 10 * 60_000) {
      cur.m += distanceM(cur.prev, p);
      cur.end = p;
      cur.prev = p;
    } else {
      if (cur) out.push({ start: cur.start.at, end: cur.end.at, km: Math.round(cur.m / 100) / 10 });
      cur = { start: p, end: p, m: 0, prev: p };
    }
  }
  if (cur) out.push({ start: cur.start.at, end: cur.end.at, km: Math.round(cur.m / 100) / 10 });
  return out.filter((s) => s.km >= 0.5);
}

/** Metres from a point to the nearest part of a line (flat-earth; fine at a few km). */
export function distanceToLineM(p: { lat: number; lng: number }, line: Array<{ lat: number; lng: number }>): number {
  if (!line.length) return Infinity;
  if (line.length === 1) return distanceM(p, line[0]!);
  const k = 111_320;
  const kx = k * Math.cos((p.lat * Math.PI) / 180);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const ax = (a.lng - p.lng) * kx;
    const ay = (a.lat - p.lat) * k;
    const dx = (b.lng - a.lng) * kx;
    const dy = (b.lat - a.lat) * k;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

export interface OffRouteSpan {
  start: string;
  end: string;
  /** Furthest it went from the route, in metres. */
  maxM: number;
}

/**
 * Driving more than `limitM` from the route's road during school runs. Two
 * points in a row must be off, so one bad GPS fix is not a detour.
 */
export function offRouteSpans(points: MetricPoint[], line: Array<{ lat: number; lng: number }>, windows: Window[], limitM = 500, tz = "Asia/Kolkata"): OffRouteSpan[] {
  if (line.length < 2) return [];
  const inRun = (iso: string) => {
    const m = localMinute(iso, tz);
    return windows.some((w) => m >= clockMin(w.start) && m <= clockMin(w.end));
  };
  const out: OffRouteSpan[] = [];
  let run: { start: string; end: string; maxM: number; n: number } | null = null;
  const close = () => {
    if (run && run.n >= 2) out.push({ start: run.start, end: run.end, maxM: Math.round(run.maxM) });
    run = null;
  };
  for (const p of points) {
    if (p.speed <= MOVING_KPH || !inRun(p.at)) continue;
    const d = distanceToLineM(p, line);
    if (d > limitM) {
      if (run) {
        run.end = p.at;
        run.maxM = Math.max(run.maxM, d);
        run.n++;
      } else run = { start: p.at, end: p.at, maxM: d, n: 1 };
    } else close();
  }
  close();
  return out;
}

export interface SpeedPoint {
  lat: number;
  lng: number;
  speed: number;
  at: string;
}

/** Points above the limit, at most one a minute, for hotspots. */
export function overspeedPoints(points: MetricPoint[], limitKph: number): SpeedPoint[] {
  const out: SpeedPoint[] = [];
  for (const p of points) {
    if (p.speed <= limitKph) continue;
    const last = out[out.length - 1];
    if (last && ms(p.at) - ms(last.at) < 60_000) {
      if (p.speed > last.speed) out[out.length - 1] = { lat: p.lat, lng: p.lng, speed: p.speed, at: p.at };
      continue;
    }
    out.push({ lat: p.lat, lng: p.lng, speed: p.speed, at: p.at });
  }
  return out;
}

export interface Hotspot {
  lat: number;
  lng: number;
  count: number;
  topSpeed: number;
  /** Most common hour of day (0–23, school time). */
  hour: number;
}

/** Overspeed points grouped into about 300 m squares, busiest first. */
export function hotspots(points: SpeedPoint[], cellM = 300, tz = "Asia/Kolkata"): Hotspot[] {
  const step = cellM / 111_320;
  const cells = new Map<string, { lat: number; lng: number; n: number; top: number; hours: number[] }>();
  for (const p of points) {
    const key = `${Math.round(p.lat / step)}:${Math.round(p.lng / step)}`;
    const c = cells.get(key) ?? { lat: 0, lng: 0, n: 0, top: 0, hours: [] };
    c.lat += p.lat;
    c.lng += p.lng;
    c.n++;
    c.top = Math.max(c.top, p.speed);
    c.hours.push(Math.floor(localMinute(p.at, tz) / 60));
    cells.set(key, c);
  }
  return [...cells.values()]
    .map((c) => {
      const counts = new Map<number, number>();
      for (const h of c.hours) counts.set(h, (counts.get(h) ?? 0) + 1);
      const hour = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      return { lat: c.lat / c.n, lng: c.lng / c.n, count: c.n, topSpeed: Math.round(c.top), hour };
    })
    .sort((a, b) => b.count - a.count || b.topSpeed - a.topSpeed);
}

/** The middle value; for typical times. */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

export interface DriverTally {
  days: number;
  overspeedEvents: number;
  harshEvents: number;
  idleMin: number;
  missedStops: number;
  afterHoursTrips: number;
  offRouteSpans: number;
}

/**
 * A safety score out of 100: penalties per day driven, so a driver with more
 * days is not punished for driving more.
 */
export function driverScore(t: DriverTally): number {
  if (!t.days) return 100;
  const perDay = (n: number) => n / t.days;
  const penalty =
    perDay(t.overspeedEvents) * 6 +
    perDay(t.harshEvents) * 8 +
    Math.min(perDay(t.idleMin) / 10, 3) * 3 +
    perDay(t.missedStops) * 4 +
    perDay(t.afterHoursTrips) * 10 +
    perDay(t.offRouteSpans) * 5;
  return Math.max(0, Math.min(100, Math.round(100 - penalty * 5)));
}
