# Greenfield Transport OS

School bus tracking, attendance, CCTV and safety for **Bharath Vidya Mandir**.

Three products are planned on one codebase and one database. **The School Admin
console is built**; the parent and crew apps are not started.

| Product | Users | URL |
| --- | --- | --- |
| **School Admin** (this app) | transport manager, school office, principal | `admin.<domain>` |
| Parent App | parents and guardians | `parents.<domain>` |
| Attendant App | bus attendants and drivers | `crew.<domain>` |

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
src/app/(admin)/          27 admin screens; the route group keeps URLs clean
                          and leaves room for (parent) and (crew) groups
src/components/transport/ shell, UI primitives, the shared dialog, the map
src/lib/transport/        types, seed data, tokens, nav, the store
docs/handoff/             the design and engineering handoff package
```

### Screens

`/` overview · `/live` `/live/trips` `/live/monitor` · `/buses` `/buses/[busId]` ·
`/routes` `/routes/[routeId]` · `/stops` · `/students` `/students/[studentId]` ·
`/drivers` · `/attendants` · `/school-trips` `/school-trips/[tripId]` ·
`/attendance` `/attendance/history` · `/cctv` `/cctv/recordings` `/cctv/health` ·
`/incidents` `/incidents/[incidentId]` · `/analytics` `/analytics/drivers`
`/analytics/reports` · `/optimize` · `/settings`

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

## What is deliberately not built

- **Authentication.** Three login flows, three cookies, roles and the audit log
  are phase 2 (`docs/handoff/README.md` §4).
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
- **The parent and crew apps.** Host-based rewriting into `(parent)` and
  `(crew)` route groups goes in `src/proxy.ts` when they start (§3).
