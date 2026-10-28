/**
 * A map position from what an admin pastes for a stop: plain coordinates
 * ("9.18129, 77.39932") or a Google Maps URL. Short links (maps.app.goo.gl)
 * are followed on the server first; this only reads text. Google's
 * share.google links lead to a search page with no position, so they read as
 * nothing here.
 */

export interface Coords {
  lat: number;
  lng: number;
}

const NUM = String.raw`-?\d{1,3}(?:\.\d+)?`;

const PATTERNS: RegExp[] = [
  // Plain "lat, lng", the way Google Maps copies a dropped pin.
  new RegExp(String.raw`^\s*(${NUM})\s*,\s*(${NUM})\s*$`),
  // The place's own pin inside a /maps/place/ URL.
  new RegExp(String.raw`!3d(${NUM})!4d(${NUM})`),
  // The map's centre: /@lat,lng,17z.
  new RegExp(String.raw`@(${NUM}),(${NUM})`),
  // ?q=lat,lng · ll= · query= · destination=
  new RegExp(String.raw`[?&](?:q|ll|query|destination|daddr)=(${NUM})(?:,|%2C)\s*(?:\+|%20)?(${NUM})`, "i"),
  // /maps/search/lat,+lng
  new RegExp(String.raw`/search/(${NUM}),\s*(?:\+|%20)?(${NUM})`, "i"),
];

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

export function coordsFromText(text: string): Coords | null {
  const value = decodeURIComponentSafe(text.trim());
  for (const pattern of PATTERNS) {
    const m = pattern.exec(value);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (valid(lat, lng)) return { lat: round(lat), lng: round(lng) };
  }
  return null;
}

/** Looks like a link rather than coordinates. */
export const isUrl = (text: string) => /^https?:\/\//i.test(text.trim());

/** "9.18129, 77.39932", the way the form shows a saved pin. */
export const formatCoords = (c: Coords) => `${c.lat}, ${c.lng}`;

const round = (n: number) => Math.round(n * 1e6) / 1e6;

function decodeURIComponentSafe(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
