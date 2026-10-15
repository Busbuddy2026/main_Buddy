/*
 * Crew app service worker — lets the attendant app open with no signal.
 *
 * Pages: network first, falling back to the last copy seen, so a cold start in
 * a dead zone still shows today's trip (the roster and queued marks live in
 * the app's own storage). Build assets are immutable, so they are served from
 * cache once fetched. API calls are never cached: the app's sync queue owns
 * what happens offline.
 *
 * Only crew pages are handled, whether served at crew.<domain>/ or /crew.
 */

const CACHE = "crew-shell-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isCrewPage(url) {
  return url.pathname.startsWith("/crew") || url.hostname.startsWith("crew.");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate" && isCrewPage(url)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match(new URL("/crew", url.origin).href)).then(
            (hit) => hit || new Response("Offline. Open the crew app once with a signal.", { status: 503 }),
          ),
        ),
    );
  }
});
