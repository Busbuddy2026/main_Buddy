import "server-only";
import { z } from "zod";

/**
 * Place names → coordinates, from OpenStreetMap's Nominatim, to suggest where
 * a stop is. Only ever a suggestion: an admin confirms every pin.
 *
 * Usage policy (operations.osmfoundation.org/policies/nominatim): at most one
 * request a second, an identifying User-Agent, and results cached. Results are
 * kept in memory for 30 days per name and area. Any failure means "no
 * suggestion", never an error.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const TTL_MS = 30 * 24 * 3600_000;
const GAP_MS = 1100;
const TIMEOUT_MS = 8000;

export interface Place {
  lat: number;
  lng: number;
  /** "village", "bus_station"… */
  kind: string;
  name: string;
}

export interface Box {
  south: number;
  west: number;
  north: number;
  east: number;
}

const resultSchema = z.array(
  z.object({ lat: z.coerce.number(), lon: z.coerce.number(), type: z.string().optional(), display_name: z.string().optional() }),
);

const cache = new Map<string, { at: number; place: Place | null }>();
let queue: Promise<unknown> = Promise.resolve();

const userAgent = () => `BusBuddy/1.0 (school transport; ${process.env.NOMINATIM_EMAIL || "support@busbuddy.app"})`;

async function fetchPlace(name: string, box: Box): Promise<Place | null> {
  const q = new URLSearchParams({
    q: name,
    format: "json",
    limit: "1",
    countrycodes: "in",
    bounded: "1",
    viewbox: `${box.west},${box.north},${box.east},${box.south}`,
  });
  const res = await fetch(`${ENDPOINT}?${q}`, {
    headers: { "user-agent": userAgent(), accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const parsed = resultSchema.safeParse(await res.json());
  const hit = parsed.success ? parsed.data[0] : undefined;
  return hit ? { lat: hit.lat, lng: hit.lon, kind: hit.type ?? "place", name: hit.display_name?.split(",")[0]?.trim() || name } : null;
}

/** One place for a name inside the box, or null. Calls are spaced a second apart, process-wide. */
export function findPlace(name: string, box: Box): Promise<Place | null> {
  const key = `${name.toLowerCase()}|${[box.south, box.west, box.north, box.east].map((n) => n.toFixed(2)).join(",")}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.place);
  const run = queue.then(async () => {
    const place = await fetchPlace(name, box).catch(() => null);
    cache.set(key, { at: Date.now(), place });
    await new Promise((r) => setTimeout(r, GAP_MS));
    return place;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** The box around some points, padded by about `padKm` on every side. */
export function boxAround(points: Array<{ lat: number; lng: number }>, padKm = 5): Box | null {
  if (!points.length) return null;
  const pad = padKm / 111;
  return {
    south: Math.min(...points.map((p) => p.lat)) - pad,
    north: Math.max(...points.map((p) => p.lat)) + pad,
    west: Math.min(...points.map((p) => p.lng)) - pad,
    east: Math.max(...points.map((p) => p.lng)) + pad,
  };
}
