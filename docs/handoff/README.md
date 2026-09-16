# Handoff: Greenfield Transport OS — school bus tracking, attendance, CCTV & safety

Three products, one backend:

| Product | Users | Deployed URL (separate login) |
|---|---|---|
| **School Admin** (desktop web) | transport manager, school office, principal | `https://admin.<domain>` → login at `/login` |
| **Parent App** (mobile web / PWA) | parents & guardians | `https://parents.<domain>` → login at `/login` |
| **Attendant App** (mobile web / PWA) | bus attendants & drivers | `https://crew.<domain>` → login at `/login` |

Each app has its **own login page, own session cookie, own credential type**. A parent session can never open the admin app, and vice versa. See "Three apps, three URLs" below for the exact Next.js setup.

---

## 1. About the design files

Everything in `design-reference/` is a **design reference built in HTML** — a clickable prototype of the intended look and behaviour. It is **not production code and must not be copied into the app**. Rebuild each screen natively in the Next.js codebase using the tokens and specs in this package.

- `School Admin.dc.html` — full admin console, 27 pages
- `Parent App.dc.html` — parent mobile app, 7 screens
- `Attendant App.dc.html` — attendant mobile app, 5 screens
- `Design System.dc.html` — colour, type, pills, buttons, inputs, radii
- `standalone/*.html` — the same three prototypes as single self-contained files; open these in a browser to click through the flows
- `school-logo.png` — placeholder school crest (replace with the real school's logo)

To view: open any file in `design-reference/standalone/` directly in a browser.

**Fidelity: high.** Colours, type scale, spacing, radii, copy and interaction states are final. Recreate them faithfully. Map data (`live-map.js`) is a stylised placeholder — the production app uses a real map SDK (§6).

---

## 2. Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15, App Router, TypeScript, React 19** | one repo, one deployment per app or one deployment with host-based routing |
| Styling | **Tailwind CSS v4** with the token set in §8 exposed as CSS variables | the prototype uses inline styles; convert to Tailwind utilities |
| UI primitives | **shadcn/ui** (Radix) for dialog, dropdown, popover, tabs, toast | restyle to match tokens — do not ship default shadcn look |
| Icons | **Material Symbols Rounded** (variable font, weight 400, FILL 0) | icon names in the prototype are literal Material Symbols names |
| Fonts | **DM Sans** (UI) + **IBM Plex Mono** (all numbers, IDs, timestamps) | `next/font/google` |
| DB | **PostgreSQL 16** + **Prisma** | schema in `prisma/schema.prisma` in this package |
| Auth | **Auth.js (NextAuth v5)**, three providers, three cookie names | §4 |
| Realtime | **Socket.IO** on a separate Node service, or **Pusher/Ably** if you want it managed | §5 |
| Maps | **MapLibre GL JS** + MapTiler tiles, **OSRM** or Google Directions for route geometry & ETA | §6 |
| Video | **HLS** (`hls.js`) from the camera vendor's RTSP→HLS gateway | §7 |
| Push | **Firebase Cloud Messaging** (web push + native wrappers later) | §7 |
| Jobs | **BullMQ + Redis** (ETA recompute, trip auto-close, digest emails, licence-expiry checks) | |
| Files | **S3-compatible** (documents, incident clips, exports) with signed URLs | |
| Tests | Vitest (unit), Playwright (one E2E per app flow in §11) | |

Monorepo layout (single Next.js app, three route groups — simplest path to "works end to end"):

```
apps/web/                     # Next.js — all three products
  app/
    (admin)/...               # host: admin.<domain>
    (parent)/...              # host: parents.<domain>
    (crew)/...                # host: crew.<domain>
    api/...                   # REST route handlers
  middleware.ts               # host → route group rewrite + session guard
services/realtime/            # Socket.IO server (device ingest + fan-out)
packages/db/                  # Prisma schema + client
packages/ui/                  # shared tokens, primitives, icons
```

---

## 3. Three apps, three URLs

Use **host-based rewriting** so each product is a real separate origin with its own cookie, while sharing one codebase and one database.

```ts
// middleware.ts
const HOSTS = {
  'admin.example.com':   '/admin',
  'parents.example.com': '/parent',
  'crew.example.com':    '/crew',
};

export function middleware(req: NextRequest) {
  const host = req.headers.get('host')!.split(':')[0];
  const base = HOSTS[host] ?? '/admin';            // local dev: use /admin, /parent, /crew paths directly
  const url = req.nextUrl.clone();
  if (!url.pathname.startsWith(base)) url.pathname = base + url.pathname;
  return NextResponse.rewrite(url);
}
```

Rules:
- Each group has its **own** `/login`, `layout.tsx`, session cookie (`gf_admin`, `gf_parent`, `gf_crew`) and `middleware` guard.
- Cookies: `httpOnly`, `secure`, `sameSite=lax`, `path=/`, domain scoped to the **subdomain only** (never `.example.com`) so sessions cannot leak across apps.
- A signed-in user hitting the wrong app gets a 403 page with a link to the correct URL, not a redirect loop.
- Local development: `admin.localhost:3000`, `parents.localhost:3000`, `crew.localhost:3000` all resolve to 127.0.0.1 in modern browsers — no hosts-file edit needed.
- Every API route resolves `schoolId` from the session, never from the request body. All queries are scoped by `schoolId` (multi-tenant from day one).

---

## 4. Authentication (per app)

**Admin** — email + password, bcrypt (cost 12), optional TOTP 2FA. Roles: `SUPER_ADMIN`, `TRANSPORT_MANAGER`, `OFFICE_STAFF`, `VIEWER`. Rate-limit 5 attempts / 15 min / IP+email. Password reset by emailed single-use token (30 min).

**Parent** — mobile number + 6-digit OTP (SMS via MSG91/Twilio). Prototype: number `98480 12345`, OTP `123456`. Production rules: OTP 6 digits, TTL 5 min, max 5 verify attempts, resend after 30 s with a visible countdown, max 5 OTPs/number/hour, number must already exist as a `Guardian` (no self-signup — the school provisions parents). Session 30 days, refreshed on use.

**Attendant/Driver** — crew ID + 4-digit PIN. Prototype: `GF-ATT-0142` / `1234`. Production: PIN hashed, lock after 5 failures until the office resets, PIN change forced on first login. Session 12 h, tied to the device (`deviceId` stored on login) so a stolen session on another device is rejected. Offline: the roster for today's trip is cached (IndexedDB) and marks are queued and replayed — this is mandatory, buses lose signal.

Audit every auth event and every write in `AuditLog`.

---

## 5. Realtime

One Socket.IO namespace per concern; rooms are `school:<id>`, `bus:<id>`, `trip:<id>`, `student:<id>`.

| Event | Emitted by | Consumed by |
|---|---|---|
| `bus.location` `{busId, lat, lng, speed, heading, ts}` | GPS device → ingest endpoint (1 ping / 10 s) | admin live map, parent track screen |
| `trip.started` / `trip.completed` | attendant app | admin, parents on that route |
| `attendance.marked` `{studentId, tripId, status, stopId, ts}` | attendant app | admin attendance centre, that student's parents (push) |
| `bus.delayed` `{busId, minutes}` | ETA job | admin, parents |
| `bus.offline` `{busId}` | heartbeat watchdog (no ping 90 s) | admin only |
| `incident.created` / `incident.updated` | admin, attendant SOS | admin, school office |
| `sos.raised` `{busId, tripId, lat, lng}` | attendant app | admin (full-screen alarm), parents of onboard students |

Client reconnect: exponential backoff, and on reconnect re-fetch the REST snapshot before resuming the stream (never trust missed events).

Device ingest is a separate authenticated endpoint (`POST /api/ingest/location`, device API key, HMAC body signature) — never the browser socket.

---

## 6. Maps and ETA

- Tiles: MapLibre GL + MapTiler (or self-hosted OpenMapTiles).
- Route geometry: OSRM `/route` between ordered stop coordinates; cache per route, invalidate when stops change.
- ETA: OSRM/Google `duration` from current bus position to each remaining stop, recomputed every 30 s; blend with a 14-day rolling median of actual arrivals at that stop and time-of-day to smooth traffic noise. "Delayed" = live ETA > scheduled arrival + 5 min.
- Geofence: 120 m radius per stop; entering the geofence auto-advances the attendant app to that stop and fires "bus approaching" push to parents ~4 min out (ETA-based, not distance).
- Bus markers: `#1a73e8` on time, `#f29900` delayed, `#9aa0a6` offline. Heading arrow, bus number in the marker label.
- Do not put student home addresses on any map the attendant can see; parents see only their own child's stop.

---

## 7. CCTV, notifications, documents

**CCTV** — vendor RTSP streams via a transcoding gateway (e.g. MediaMTX) to HLS; the browser plays with `hls.js`. Grid view = 6 tiles max per page, lazy-mount players, unmount on page change (memory). Recordings are event-indexed: harsh braking, SOS, door-open-in-motion, manual clip. Retention 30 days, then lifecycle-delete from S3. Every playback and download is written to `AuditLog` (`CCTV_VIEW`) — it is student video.

**Face recognition is explicitly out of scope / "coming soon"** in the design. Keep the disabled control and the badge; do not implement.

**Notifications** — FCM topics per student (`student_<id>`) and per route. Templates: bus started, approaching stop, boarded, dropped, absent, delay, route change, incident, weekly digest (Friday 6 PM). Parent preference toggles (alerts / delay+route / weekly digest) must actually gate sending. Quiet hours 9 PM–5 AM for non-critical types.

**Documents** — bus RC, insurance, fitness, permit, pollution; driver licence, police verification, medical. Each has issue/expiry dates; a nightly job flags anything expiring within 30 days and surfaces it on the bus profile and drivers list (`Expires in 24 days` pill, `#fef7e0`/`#8f5b00`).

---

## 8. Design tokens

```
Canvas    #f6f7f9   app background
Surface   #ffffff   cards, tables, sheets
Line      #e4e7eb   borders, dividers   (soft divider #eceef1, inner rule #f3f4f6)
Ink       #16181b   primary text
Ink-2     #3c4149   secondary UI text
Muted     #5f6672   descriptions, labels
Faint     #8b919b   meta, placeholders  (disabled text #a8aeb7)
Primary   #1a73e8   actions, live state (hover #1558b8, tint #e8f0fe, tint-line #cfe0fb)
Success   #1e8e3e   safe, completed     (tint #e6f4ea, text #186c33)
Warning   #f29900   delayed, pending    (tint #fef7e0, text #8f5b00)
Critical  #d93025   emergency           (hover #b3261e, tint #fce8e6, text #c5221f, line #f7c8c4)
Neutral   #9aa0a6   inactive            (tint #f1f3f4)
```

Type — DM Sans 400/500/600/700, IBM Plex Mono 400/500 for **every** number, ID, plate and timestamp.

| Role | Size / weight / tracking |
|---|---|
| Display | 34 / 600 / -0.03em |
| Page title | 22 / 600 / -0.02em |
| Section | 15 / 600 |
| Body | 13.5 / 400 |
| Table cell | 12.5–13 / 400 (headers 11 / 600 / 0.06em / uppercase / `#8b919b`) |
| Label | 11 / 600 / 0.04em / uppercase |
| Metric | 20–34 / 500–600 IBM Plex Mono |
| Mobile body | 14–15 / 400; mobile titles 22–24 / 600 |

Spacing — 4px base. Card padding 20–26px desktop, 16–20px mobile. Grid gaps 14–22px.
Radii — chips 8, controls 9–10, cards 14–16, mobile cards 18–20, pills 999.
Shadows — only two: dropdown `0 10px 28px rgba(16,24,40,.14)`, modal `0 24px 60px rgba(16,24,40,.18)`. Cards use borders, never shadows.
Focus ring — `border:1px solid #1a73e8; box-shadow:0 0 0 3px rgba(26,115,232,.14)`.

**Status pills** — 5px/11px padding, 999 radius, 11.5/600, 6px dot. Tones: live `#e8f0fe`/`#1558b8`, good `#e6f4ea`/`#186c33`, warn `#fef7e0`/`#8f5b00`, bad `#fce8e6`/`#c5221f`, idle `#f1f3f4`/`#5f6672`. Vocabulary: Trip (Scheduled, Active, Completed, Delayed, Cancelled) · Student (Expected, Boarded, Absent, Dropped, Pending) · Bus (Active, Idle, Offline, Delayed, Maintenance) · Camera (Live, Recording, Offline, Issue detected) · Incident (New, Under review, Investigating, Resolved, Closed).

**Rules** — colour carries status only, never decoration. Max two background colours per screen. Attendant touch targets ≥ 48px tall (used in a moving bus). Text contrast ≥ 4.5:1.

---

## 9. Screens

Full screen-by-screen spec with layouts, columns, copy and interactions: **`SCREENS.md`**.
REST endpoints, payloads and validation: **`API.md`**.
Database: **`prisma/schema.prisma`**.
Repo conventions to drop into the new project: **`CLAUDE.md`**.

---

## 10. Build order

Ship in this sequence; each phase is independently demoable.

1. **Foundation** — repo, Prisma schema, seed script (use the prototype's seed data: 6 buses, 4 routes, 15 stops, 8 students, 5 drivers, 4 attendants), tokens, layout shells, host routing.
2. **Auth** — three login flows, guards, roles, audit log.
3. **Masters + CRUD** — buses, routes, stops, students, drivers, attendants; create/edit/delete dialogs, filters, search, empty states.
4. **Attendant app** — trip start, stop-by-stop roster, board/absent/drop marking, undo, offline queue, trip summary, complete trip, SOS.
5. **Attendance** — admin attendance control centre + history, exports.
6. **Live tracking** — device ingest, socket fan-out, admin live map, parent track screen, ETA + delay detection.
7. **Parent app** — home, track, alerts, history, absence reporting, profile & preferences, push.
8. **CCTV & safety** — camera list, live grid, recordings, camera health, incidents workflow.
9. **School trips** — trip planning, fleet assignment, manifest, consent, live tracking of the excursion.
10. **Analytics & reports** — punctuality, utilisation, driver performance, scheduled exports.
11. **Settings** — school profile, session times, attendance rules, notification rules, retention, roles.

Route Optimization stays a "coming soon" placeholder (it is marked `SOON` in the nav).

---

## 11. Definition of "works end to end"

A Playwright suite must pass this scenario against a seeded database:

1. Admin signs in at `admin.*`, creates a bus, a route with 5 stops, assigns a driver and attendant, and adds a student to a stop.
2. Attendant signs in at `crew.*` with crew ID + PIN, sees today's morning trip, starts it.
3. A simulated GPS device posts location pings; the admin live map and the parent track screen both move within 2 seconds.
4. Attendant marks the student Boarded at their stop; the parent receives the alert, the admin attendance centre row flips to Boarded with a timestamp, and the student's profile timeline records it.
5. Attendant completes the trip; the summary totals match the marks and the trip appears in attendance history.
6. Parent reports tomorrow's morning absence; the attendant's roster for that trip shows the student as excused and the admin sees the request.
7. Attendant raises SOS; an incident is created, the admin gets a critical alert, and the incident can be moved New → Investigating → Resolved with a note.
8. Each app rejects the other two apps' sessions.

---

## 12. Open items for the school to confirm

- Real school name, logo, branding (prototype uses "Bharath Vidya Mandir" and a placeholder crest).
- GPS hardware vendor and its data format; CCTV vendor and whether it can emit RTSP/HLS.
- SMS gateway (DLT template registration is required in India and takes days).
- Data retention policy for video and location history, and who may view CCTV.
- Whether drivers get their own login or share the attendant app.
