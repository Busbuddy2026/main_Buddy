# Greenfield Transport OS

School bus tracking, attendance, CCTV and safety for **Bharath Vidya Mandir**.

Three products share one codebase and one database. All three are built.

| Product | Users | Host | Local |
| --- | --- | --- | --- |
| **School Admin** | transport manager, school office, principal | `admin.<domain>` | `/` |
| **Parent App** | parents and guardians | `parents.<domain>` | `/parent` |
| **Attendant App** | bus attendants and drivers | `crew.<domain>` | `/crew` |

[`src/proxy.ts`](src/proxy.ts) rewrites each subdomain onto its path prefix, so
locally `parents.localhost:3000` and `crew.localhost:3000` serve the mobile apps
while plain `localhost:3000` serves the admin console. The path prefixes also
work directly, which is handy when you just want to click through everything on
one origin.

The full brief, screen specs, REST contract and database schema live in
[`docs/handoff/`](docs/handoff/). The clickable HTML prototypes the console was
built against are in `docs/handoff/design-reference/standalone/` — open any of
them in a browser.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

Environment variables go in `.env.local` (see `.env.example`). Supabase
credentials are only used by the existing `/todos` route and the session refresh
in `src/proxy.ts`; the admin console does not need them yet.

## Stack

- **Next.js 16** (App Router) + **React 19** + TypeScript
- **Tailwind CSS v4** — tokens declared with `@theme` in `src/app/globals.css`
- **DM Sans** and **IBM Plex Mono** via `next/font/google`; **Material Symbols
  Rounded** linked from Google Fonts (it is not in the `next/font` catalogue)
- **Leaflet** for the live map, on CARTO Voyager tiles

Next.js 16 renamed the `middleware` file convention to `proxy`, so route
interception lives in [`src/proxy.ts`](src/proxy.ts).

## Layout

```
src/app/(admin)/          27 desktop admin screens, served from the root
src/app/(parent)/parent/  7 parent screens
src/app/(crew)/crew/      5 attendant screens
src/components/transport/ admin shell, UI primitives, the dialog, the map
src/components/mobile/    phone frame, status bar, keypad, confirm sheet
src/components/parent/    parent shell and login
src/components/crew/      crew shell, login, action footer
src/lib/transport/        types, seed data, tokens, nav, the three stores
docs/handoff/             the design and engineering handoff package
```

### Screens

`/` overview · `/live` `/live/trips` `/live/monitor` · `/buses` `/buses/[busId]` ·
`/routes` `/routes/[routeId]` · `/stops` · `/students` `/students/[studentId]` ·
`/drivers` · `/attendants` · `/school-trips` `/school-trips/[tripId]` ·
`/attendance` `/attendance/history` · `/cctv` `/cctv/recordings` `/cctv/health` ·
`/incidents` `/incidents/[incidentId]` · `/analytics` `/analytics/drivers`
`/analytics/reports` · `/optimize` · `/settings`

**Parent** — `/parent` home · `/parent/track` · `/parent/alerts` ·
`/parent/history` · `/parent/absence` · `/parent/profile`, plus the OTP login.

**Attendant** — `/crew` today's bus · `/crew/stop` marking · `/crew/summary` ·
`/crew/profile`, plus the crew ID + PIN login.

## Signing in and out

Each app has its own sign-in screen and its own way out.

| App | Sign in with | Demo credentials | Sign out from |
| --- | --- | --- | --- |
| Admin | work email + password | `transport@bvm.edu.in` / `demo1234` | avatar menu, top right |
| Parent | mobile number + 6-digit OTP | `98480 12345` / `123456` | Profile tab → Log out |
| Attendant | crew ID + 4-digit PIN | `GF-ATT-0142` / `1234` | Profile → Log out |

The parent and crew credentials come from the prototypes; the admin pair is a
placeholder, since the handoff does not specify one.

**These are demo gates, not authentication.** The session is React state, so a
refresh returns you to the sign-in screen, and nothing is enforced on the
server. See "What is deliberately not built" below.

## Data

There is **no database yet**. `src/lib/transport/store.tsx` holds the seven
collections in a reducer seeded from `src/lib/transport/seed.ts`, which carries
the prototype's data verbatim: 6 buses, 4 routes, 15 stops, 8 students, 5
drivers, 4 attendants, 3 school trips. Create, edit, delete and stop reordering
all work against that store and persist for the session.

Its action names map one-to-one onto the REST routes in
[`docs/handoff/API.md`](docs/handoff/API.md), so replacing the dispatchers with
server actions over the Prisma schema in `docs/handoff/prisma/schema.prisma`
does not change any screen.

The parent and crew apps have their own stores on the same footing. The crew
store keys attendance marks by `(phase, studentId)` — the key the server uses to
make replayed marks idempotent — and enforces the rule that a drop cannot be
recorded for a student who never boarded.

## What is deliberately not built

- **Authentication.** All three apps have a sign-in screen and a sign-out
  control, but they are a client-side gate, not auth: the session lives in React
  state, so a refresh returns to the sign-in screen and nothing is enforced on
  the server. Real sign-in — three cookies (`gf_admin`, `gf_parent`, `gf_crew`),
  bcrypt and optional TOTP for admin, OTP delivery for parents, device-bound
  PINs for crew, roles, rate limiting, password reset and the audit log, with
  the cross-app 403 guard in `src/proxy.ts` — is phase 2
  (`docs/handoff/README.md` §4).
- **The attendant offline queue.** The roster is not cached and marks are not
  queued for replay (§C6). The mark key is already the right shape for it.
- **Realtime.** The map animates buses along their stop polylines instead of
  consuming `bus.location` over Socket.IO (§5). Production also swaps Leaflet
  for MapLibre GL + MapTiler with OSRM geometry (§6).
- **Live video.** CCTV tiles and the recordings player are placeholders until
  the vendor's RTSP→HLS gateway exists (§7). Every playback must be audit-logged
  as a `CCTV_VIEW` when it does.
- **Face recognition attendance.** Out of scope by design — the control is
  present, disabled and badged "coming soon" on both `/attendance` and
  `/settings`.
- **Route optimization.** `/optimize` is a coming-soon page with no
  functionality, as specified.
- **Push notifications.** The parent preference toggles are wired to state but
  do not gate anything yet; FCM topics per student are phase 7 (§7).
