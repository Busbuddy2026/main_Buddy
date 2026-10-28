import "server-only";
import type { Tx } from "@/server/db";
import { readSettings } from "@/lib/api/schemas/settings";
import { coordsFromText, type Coords } from "@/lib/location";
import { localMinute, median } from "@/lib/fleet-metrics";

/**
 * Where the school is: Settings → School location when set; otherwise the
 * middle of where the buses' finished morning runs (starting before 11 AM)
 * have ended lately: they end at school. Null until either exists.
 */

const TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; value: (Coords & { source: "settings" | "trips" }) | null }>();

export async function schoolPoint(db: Tx, schoolId: string): Promise<(Coords & { source: "settings" | "trips" }) | null> {
  const hit = cache.get(schoolId);
  // An unknown school is checked again soon: the trips that place it may have just been saved.
  if (hit && Date.now() - hit.at < (hit.value ? TTL_MS : 60_000)) return hit.value;
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { settings: true } });
  const set = coordsFromText(readSettings(school.settings).schoolLocation);
  let value: (Coords & { source: "settings" | "trips" }) | null = set ? { ...set, source: "settings" } : null;
  if (!value) {
    const rows = await db.busDay.findMany({ where: { schoolId }, orderBy: { date: "desc" }, take: 40, select: { trips: true } });
    // Morning runs only (they start before 11 AM) and only finished ones: they end at school.
    const ends = rows
      .flatMap((r) => r.trips as unknown as Array<{ start: string; to?: Coords | null }>)
      .filter((t) => localMinute(t.start) < 11 * 60)
      .map((t) => t.to)
      .filter((p): p is Coords => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const lat = median(ends.map((p) => Math.round(p.lat * 1e5)));
    const lng = median(ends.map((p) => Math.round(p.lng * 1e5)));
    value = lat != null && lng != null ? { lat: lat / 1e5, lng: lng / 1e5, source: "trips" } : null;
  }
  cache.set(schoolId, { at: Date.now(), value });
  return value;
}

/** Forget the cached point (the setting changed). */
export const forgetSchoolPoint = (schoolId: string) => void cache.delete(schoolId);
