import "server-only";
import { coordsFromText, isUrl, type Coords } from "@/lib/location";

/**
 * A stop's position from a pasted Google Maps link. Short links redirect to
 * the full URL that carries the coordinates, so redirects are followed by
 * hand, only between Google's own map hosts (so the server cannot be pointed
 * at anything else), at most five hops.
 */

const HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "maps.google.com", "google.com", "www.google.com", "share.google", "g.co"]);
const MAX_HOPS = 5;
const TIMEOUT_MS = 5000;

export const NO_POSITION =
  "That link has no map position. In Google Maps, open the stop and tap Share → Copy link (a maps.app.goo.gl link), or press and hold the spot and copy the numbers shown.";

function allowed(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && HOSTS.has(url.hostname.toLowerCase()) ? url : null;
  } catch {
    return null;
  }
}

/** Coordinates, a link that leads to coordinates, or null. */
export async function resolveLocation(text: string): Promise<Coords | null> {
  const direct = coordsFromText(text);
  if (direct || !isUrl(text)) return direct;
  let url = allowed(text.trim());
  for (let hop = 0; url && hop < MAX_HOPS; hop++) {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "Mozilla/5.0 (BusBuddy stop locator)" } }).catch(
      () => null,
    );
    const next = res?.headers.get("location");
    if (!res || !next || res.status < 300 || res.status >= 400) return null;
    const target = new URL(next, url).toString();
    const found = coordsFromText(target);
    if (found) return found;
    url = allowed(target);
  }
  return null;
}
