# Backend

How the three apps store and read data. For the product brief see
`docs/handoff/README.md`. Where the handoff's `API.md` and this file disagree,
this file describes what is built.

## Stack

- **Database:** Postgres on Supabase. All tables live in the `transport` schema,
  not `public`.
- **ORM:** Prisma 7 with the `pg` driver adapter. The client is generated into
  `src/generated/prisma`, which is git-ignored.
- **Auth:** our own, not Supabase Auth. There are three independent httpOnly
  cookies: `gf_admin`, `gf_parent` and `gf_crew`.
- **API:** route handlers under `src/app/api`. Every handler goes through
  `route()` or `publicRoute()` in `src/server/http/handler.ts`.
- **Files:** a private Supabase Storage bucket called `documents`. Without
  `SUPABASE_SERVICE_ROLE_KEY`, development stores files on disk in `.data/uploads`.

## Layout

| Path | What lives there |
|---|---|
| `prisma/schema.prisma` | Schema. Additions over the handoff schema are marked `Added:` |
| `prisma/migrations/` | Versioned SQL migrations |
| `prisma/sql/lockdown.sql` | Revokes `anon`/`authenticated` access and enables RLS. Run after every migration |
| `prisma/seed.ts` | Real database: the school and its two admin sign-ins, nothing else |
| `prisma/seed-demo.ts` | Test database only: prototype data plus two weeks of trip history |
| `scripts/test-db.mjs` | Runs a command with `DATABASE_URL`/`DIRECT_URL` pointed at `DATABASE_URL_TEST` |
| `src/server/http/` | `route()` wrapper and the error envelope |
| `src/server/auth/` | Hashing, sessions, rate limits |
| `src/server/services/` | Business rules, one file per area |
| `src/lib/api/` | Shared with the browser: Zod schemas, envelope, typed `api` client, `useApi`, `usePoll` |

## The rules `route()` enforces

These are in one place so that no handler can skip them.

1. **The session matches the app.**
   - A request with another app's cookie and none of its own gets **403
     WRONG_APP**.
   - A request with no cookie gets **401**.
   - Deleted or suspended accounts are refused at once, not when their cookie
     expires.
2. **`schoolId` comes from the session.** Every service filters by it. An id
   from another school reads as "not found". This was verified with a second
   school.
3. **Admin roles.**
   - `VIEWER` can read but not write.
   - Some routes narrow further: settings and backup need `SUPER_ADMIN` or
     `TRANSPORT_MANAGER`, and staff accounts need `SUPER_ADMIN`.
4. **Zod validation.** Errors come back as
   `{error:{code,message,fields}}`, and the forms show `fields` under each input.
5. **Every write runs in one transaction with at least one `AuditLog` row.**
   Camera and recording views are audited too.
6. **`Idempotency-Key`.** A retried write returns the first response.

## Endpoints

### Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/admin/login` | |
| POST | `/api/auth/admin/forgot` | |
| POST | `/api/auth/admin/reset` | |
| POST | `/api/auth/parent/otp` | |
| POST | `/api/auth/parent/verify` | |
| POST | `/api/auth/crew/login` | |
| GET | `/api/auth/{app}/session` | |
| POST | `/api/auth/{app}/logout` | |

### Admin

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/masters` | Every master record, shaped for the console |
| POST | `/api/admin/{buses,students,drivers,attendants,routes,stops,school-trips}` | Answers with `{id, data}`, where `data` is the refreshed master data |
| PATCH, DELETE | `/api/admin/{resource}/:id` | Deletes are soft |
| POST | `/api/admin/routes/:id/move-stop` | |
| POST | `/api/admin/{drivers,attendants}/:id/reset-pin` | |
| POST | `/api/admin/{owner}/:id/upload-url`, then `/documents` | |
| POST | `/api/admin/school-trips/:id/{manifest,consent,status}` | |
| GET, DELETE | `/api/admin/documents/:id` | |
| GET | `/api/admin/trip-manifests/:id` | |
| GET | `/api/admin/attendance/{today,history,export}` | |
| POST | `/api/admin/attendance/correct` | |
| POST | `/api/admin/absences/:id/acknowledge` | |
| GET, POST | `/api/admin/incidents` | |
| GET, PATCH | `/api/admin/incidents/:idOrCode` | |
| GET | `/api/admin/cctv/cameras` | |
| PATCH | `/api/admin/cctv/cameras/:id` | |
| POST | `/api/admin/cctv/cameras/:id/view` | |
| POST | `/api/admin/cctv/buses/:id/ticket` | |
| GET | `/api/admin/cctv/recordings` | |
| POST | `/api/admin/cctv/recordings/:id/view` | |
| POST | `/api/admin/cctv/backup` | |
| PUT | `/api/admin/cctv/drive` | |
| GET | `/api/admin/analytics`, `/api/admin/analytics/drivers` | |
| GET | `/api/admin/reports/{attendance,trips,incidents}` | CSV |
| GET, PATCH | `/api/admin/settings` | |
| GET, POST | `/api/admin/users` | |
| PATCH | `/api/admin/users/:id` | |

### Parent

All child endpoints check that the guardian is linked to that child.

| Method | Path |
|---|---|
| GET | `/api/parent/children/:id/{today,history,contacts}` |
| GET, POST | `/api/parent/children/:id/absences` |
| DELETE | `/api/parent/absences/:id` |
| GET | `/api/parent/notifications` |
| POST | `/api/parent/notifications/read` |
| PATCH | `/api/parent/preferences` |

### Crew

| Method | Path |
|---|---|
| GET | `/api/crew/plan` |
| POST | `/api/crew/sync` |

## Crew offline model

The phone keeps two things in local storage, keyed by crew member:

- the last plan: bus, stops, riders and marks;
- a queue of events: `start`, `mark`, `undo`, `complete` and `sos`.

Each event carries its own id, the device time, and the school date and trip
phase it belongs to. Because of that, a whole trip can run with no signal. The
screens show the plan with the queued events applied on top (`overlay()` in
`crew-store.tsx`).

`POST /api/crew/sync` replays the queue in order:

- Each event commits in its own transaction and is applied at most once, by
  `opId` and also by `clientMarkId`.
- If two marks for the same student and trip conflict, the later device time
  wins.
- A refused event, such as a student who is not on this bus or an expired undo
  window, is dropped and shown to the attendant.
- An unexpected failure stops the replay, so later events never apply before
  earlier ones.

A service worker (`public/crew-sw.js`, production only) caches the crew pages
so a cold start works offline.

## Live tracking and dashcams (LivePin)

- **Client:** `src/server/vendors/livepin.ts` signs in with the API key and secret,
  caches the JWT and signs in again before it expires.
  - It calls only `GET /api/v2/vehicles`, `GET /api/vehicles/:vehicleId/location-history`
    and `GET /api/vehicles/:vehicleId/v2/get-dashcam-stream`.
  - Every response is parsed down to the fields we use.
  - **Never call the legacy `GET /api/vehicles`:** it returns other users'
    password hashes and emails.
- **Linking:** a tracker is linked to a bus in Settings → Tracking provider,
  which creates a `GpsDevice` row and one `Camera` per dashcam channel.
- **Sync:** `src/server/services/tracking.ts`, function `syncFleet`. It runs on
  demand when a live screen loads (at most every 30 seconds), on every LivePin
  webhook push, and from `GET /api/cron/livepin` (bearer `CRON_SECRET`) when a
  scheduler calls it. There is no `vercel.json` cron: Vercel Hobby allows only
  daily crons, so use Vercel Pro or an external scheduler (cron-job.org or
  similar) hitting the route every minute. Each sync:
  - stores the last fix on `GpsDevice`;
  - adds a `LocationPing` (kept 30 days);
  - sets the bus status (ACTIVE, IDLE, OFFLINE after 10 minutes without a fix, or DELAYED);
  - sets the running trip's delay from the ETA to its next stop;
  - turns vendor alarms into incidents (emergency → SOS critical; collision or
    rollover → high; overspeed → low), once per alarm type per 30 minutes.
- **Webhook:** `/api/webhooks/livepin` takes LivePin's SOS, overspeed and
  geofence alerts, checked against `LIVEPIN_WEBHOOK_SECRET`.
- **Screens:** `GET /api/admin/live` feeds every admin map. The crew plan and the
  parent's `today` carry a `live` block. Parents get it only while their
  child's trip is running.
- **Dashcam:** `POST /api/admin/cctv/buses/:busId/stream` writes the `CCTV_VIEW`
  audit row, starts the stream and returns the LivePin player URL, shown in an
  iframe. The camera can take a few seconds to wake, so the first try may fail.
- **Account:** credentials are per school in `TrackingAccount`, with the secret
  AES-256-GCM encrypted (`TRACKING_ENC_KEY`).
  - Manage them in Settings → Tracking provider: `/api/admin/tracking/account`.
  - The env `LIVEPIN_*` values seed the account once.
- **Onboarding:** the bus form has a "GPS & camera" section.
  - Pick the tracker, set its alerts (overspeed limit, engine, geofence, safe
    parking) and the reporting interval.
  - The link saves with the bus. The settings go to LivePin after the save,
    through `PUT /api/admin/telematics/:busUid/settings` (audited
    `TRACKER_SETTINGS`, with before and after values).
- **Bus page data**, from `/api/admin/telematics/:busUid/{live,day,alerts,settings}`:

  | Tab | What it shows |
  |---|---|
  | Overview | Tracker health: model, IMEI, GPS lock, satellites, battery, main power, signal, data delay, interval, subscription |
  | Live Trip | Speed, heading, altitude, ignition, status and since when, doors, door lock, load, circuit, fuel line, alarms, address |
  | History | The daily report (distance; moving, engine-on, idle and parked time; max and average speed; overspeed), a MOVE/STOP timeline, stops, ignition, geofence and overspeed events, and route replay |
  | Alerts | The vendor alert feed, linked to incidents |
  | CCTV | The inline player |
- **Alert feed:** `syncFleet` pulls `/api/notifications/alerts` from each device's
  `alertsCursor` into `TrackerEvent` (kept 30 days). `FEED_RULES` raises
  incidents:
  - SOS → critical;
  - power cut, wire disconnect, vibration or tamper → high;
  - overspeed and ADAS → low.

  Other alerts are stored only.
- **Fleet:** Analytics → "Fleet telematics" (`/api/admin/analytics/telematics`).

## Deferred, by design

These are planned for later, not missing by accident.

- **Recorded CCTV clips.** Live dashcam video works through LivePin. Playing
  back recorded clips and the copy to Drive still wait for a vendor endpoint.
- **Cameras on unlinked buses** have no video source.
- **SMS and push.**
  - OTPs and reset links are only echoed back with `DEV_ECHO_SECRETS=1`.
  - Notifications are stored in the database and shown in-app.
  - Each delivery point is marked `TODO(sms)`, `TODO(email)` or `TODO(drive)`.

## Going live

Production deploys from `main` on Vercel. The production settings live in the
git-ignored `.env.vercel`; Next.js never loads it, so local work stays on
`.env.local`.

1. Paste the Supabase `DATABASE_URL` (transaction pooler, port 6543) and
   `DIRECT_URL` (session pooler or direct, port 5432) into `.env.vercel`.
   End `DIRECT_URL` with `?schema=transport`: Prisma keeps its migrations log
   in the URL's schema, and `public` already holds the marketing site's
   `demo_requests`, so without it `migrate deploy` stops with P3005.
2. `npm run db:prod:deploy` — migrations plus lockdown on the production database.
3. `npm run db:prod:seed` — the school and the `transport@` / `principal@`
   sign-ins, with `SEED_ADMIN_PASSWORD` from the same file. Change it after
   the first sign-in.
4. Copy every value in `.env.vercel` into Vercel → Settings → Environment
   Variables (Production). Never set `DEV_ECHO_SECRETS` there.
5. Merge into `main`. Then link the tracker in the bus form (Settings →
   Tracking provider shows the LivePin account), register
   `https://<domain>/api/webhooks/livepin` with `LIVEPIN_WEBHOOK_SECRET` in
   LivePin, and point a scheduler at `/api/cron/livepin`.

## Running it

```bash
npm install                 # also runs prisma generate
npm run db:deploy           # apply migrations + lockdown (CI, prod, any non-interactive shell)
npm run db:migrate          # dev: create a migration from schema changes (interactive)
npm run db:seed             # once per empty real database: school + admin sign-ins
npm run dev
npm test                    # unit tests (Vitest)

# Test database (DATABASE_URL_TEST), demo data only
npm run db:test:deploy      # migrations + lockdown on the test database
npm run db:seed:demo        # prototype data, once
npm run test:e2e            # starts `npm run dev:test` on :3100 against it
```

- **Restart `npm run dev` after a migration.** The running server holds the old
  Prisma client.
- **Two databases.** The real one (`DATABASE_URL`) holds only what the school
  enters and what the trackers send: no demo rows. Demo data lives in the
  test database, and the e2e suite runs against it on port 3100
  (`.next-test` build folder, so it runs beside `npm run dev`). Its global
  setup clears sign-in rate limits and links Bus 12 to the LivePin account's
  tracker.
- **Real sign-ins:** `npm run db:seed` creates `transport@bvm.edu.in` and
  `principal@bvm.edu.in` with `SEED_ADMIN_PASSWORD`, or prints a random one.
  Change it after the first sign-in.
- **Demo sign-ins (test database only):**

  | App | Credentials |
  |---|---|
  | Admin | `transport@bvm.edu.in` / `demo1234` (`principal@…` is super admin, `office@…` is viewer) |
  | Parent | `98480 12345`, with the OTP shown on screen in development |
  | Crew | `GF-ATT-0142` / `1234` |
