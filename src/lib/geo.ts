/**
 * Small geometry for live tracking: distances, ETA, and where a bus is along
 * its stop sequence. Pure functions, shared by the server and the tests.
 */

export interface Point {
  lat: number;
  lng: number;
}

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceM(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** City buses rarely average more than this; slower readings mean traffic or a stop. */
export const MIN_ETA_SPEED_KPH = 15;

/** Minutes to cover `metres` at the current speed (floored at 15 km/h). */
export function etaMinutes(metres: number, speedKph: number): number {
  const kph = Math.max(speedKph, MIN_ETA_SPEED_KPH);
  return Math.max(0, Math.round((metres / 1000 / kph) * 60));
}

/** Within this distance the bus counts as at the stop. */
export const AT_STOP_M = 200;

export interface StopOnRoute extends Point {
  id: string;
  name: string;
  /** Scheduled time at this stop for this trip, "HH:MM" in the school's timezone. */
  time: string;
}

/**
 * The stop the bus is heading to, in trip order. The nearest stop is where the
 * bus is; once within 200 m of it, it is heading to the one after.
 */
export function nextStop(bus: Point, stops: StopOnRoute[]): { stop: StopOnRoute; index: number; metres: number } | null {
  const usable = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  if (!usable.length) return null;
  let nearest = 0;
  let best = Infinity;
  usable.forEach((s, i) => {
    const d = distanceM(bus, s);
    if (d < best) {
      best = d;
      nearest = i;
    }
  });
  const index = best <= AT_STOP_M && nearest < usable.length - 1 ? nearest + 1 : nearest;
  const stop = usable[index]!;
  return { stop, index, metres: distanceM(bus, stop) };
}

/** Minutes past the scheduled time the bus will reach `stopTime` ("HH:MM"), never negative. */
export function delayMinutes(nowLocalMinutes: number, eta: number, stopTime: string): number {
  const [h, m] = stopTime.split(":").map(Number);
  const scheduled = (h ?? 0) * 60 + (m ?? 0);
  return Math.max(0, nowLocalMinutes + eta - scheduled);
}

/** Minutes since midnight in the school's timezone. */
export function localMinutes(at: Date, tz = "Asia/Kolkata"): number {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false })
    .format(at)
    .split(":")
    .map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
