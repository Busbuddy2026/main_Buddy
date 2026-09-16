# API

REST route handlers under `app/api/`. JSON in, JSON out. Every response envelope: `{ data }` or `{ error: { code, message, fields? } }`. Validation with Zod at the route boundary. `schoolId` always comes from the session, never the body. Pagination: `?page=1&pageSize=50`, response `{ data, meta: { page, pageSize, total } }`. Mutations require an `Idempotency-Key` header where noted.

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/admin/login` | `{email, password, totp?}` → sets `gf_admin` cookie |
| POST | `/api/auth/admin/forgot` / `/reset` | emailed single-use token, 30 min |
| POST | `/api/auth/parent/otp/request` | `{phone}` → 204 always (no user enumeration); 5/hour/number |
| POST | `/api/auth/parent/otp/verify` | `{phone, code}` → sets `gf_parent`; 5 attempts, 5 min TTL |
| POST | `/api/auth/crew/login` | `{crewId, pin, deviceId}` → sets `gf_crew`; lock after 5 failures |
| POST | `/api/auth/logout` | clears the calling app's cookie only |
| GET | `/api/auth/session` | current principal + role + scope |

## Masters (admin only)

Standard CRUD for each: `GET /api/<res>` (filters below), `POST /api/<res>`, `GET/PATCH/DELETE /api/<res>/:id`. Delete is soft.

| Resource | List filters | Notes |
|---|---|---|
| `buses` | `q, status, routeId` | status ∈ active, idle, offline, delayed, maintenance |
| `routes` | `q, zone, status` | `PATCH /api/routes/:id/stops` reorders (`{stopIds:[]}`) and recomputes geometry + times |
| `stops` | `q, routeId` | lat/lng required |
| `students` | `q, busId, routeId, grade` | |
| `drivers` | `q, status, licenceExpiringDays` | |
| `attendants` | `q, status` | |
| `guardians` | `q, studentId` | parent accounts are provisioned here |
| `documents` | `ownerType, ownerId` | `POST /api/documents/upload-url` → signed S3 PUT |

## Trips & attendance

| Method | Path | Notes |
|---|---|---|
| GET | `/api/trips?date&status&busId` | daily trips (generated nightly from route schedules) |
| GET | `/api/trips/:id` | includes stops, roster, marks |
| POST | `/api/trips/:id/start` | crew only, own trip; sets `startedAt`, emits `trip.started` |
| POST | `/api/trips/:id/complete` | rejects while any student is pending unless `{force:true, reason}` |
| POST | `/api/trips/:id/attendance` | **idempotent**, batch: `{marks:[{studentId, phase:'board'\|'drop', status:'boarded'\|'dropped'\|'absent', stopId, markedAt}]}` — accepts offline-queued marks with client timestamps; server rejects a drop with no prior boarding |
| DELETE | `/api/trips/:id/attendance/:studentId?phase=` | undo, allowed for 10 min or until trip completion |
| GET | `/api/attendance/today?busId&tripPhase&status` | admin control centre |
| GET | `/api/attendance/history?from&to&busId` | daily rollups |
| GET | `/api/attendance/export?from&to&format=csv\|pdf` | streamed |
| POST | `/api/absences` | parent: `{studentId, date, phase:'am'\|'pm'\|'both', reason}` |
| GET/DELETE | `/api/absences/:id` | cancel allowed until the trip starts |

## Tracking

| Method | Path | Notes |
|---|---|---|
| POST | `/api/ingest/location` | **device only** — API key + HMAC. `{deviceId, lat, lng, speed, heading, ts}`, batched array allowed. Rate limit 1/5 s per device |
| GET | `/api/buses/:id/location` | latest fix + staleness |
| GET | `/api/buses/:id/history?from&to` | polyline for replay |
| GET | `/api/trips/:id/eta` | ETA per remaining stop |
| GET | `/api/parent/track/:studentId` | scoped: only that guardian's child; returns bus position, ETA to their stop, crew contacts |

## CCTV & safety

| Method | Path | Notes |
|---|---|---|
| GET | `/api/cameras?busId&status` | |
| GET | `/api/cameras/:id/stream` | short-lived signed HLS URL; logs `CCTV_VIEW` |
| GET | `/api/recordings?busId&day&cameraId&eventType` | |
| GET | `/api/recordings/:id/download` | signed URL, audit-logged |
| POST | `/api/recordings/backup` | `{day, busId?}` → queues Drive copy |
| GET | `/api/cameras/health` | counts + per-bus detail |
| GET/POST | `/api/incidents` | `{busId, tripId?, type, severity, description, clipIds[]}` |
| PATCH | `/api/incidents/:id` | status transition + note, audit-logged |
| POST | `/api/sos` | crew: `{tripId, lat, lng}` → creates a critical incident, emits `sos.raised`, pushes to admin and onboard students' guardians |

## School trips

`GET/POST /api/school-trips`, `GET/PATCH/DELETE /api/school-trips/:id`, `POST /api/school-trips/:id/fleet` (assign bus+driver+attendant), `POST /api/school-trips/:id/manifest` (add/remove students), `GET /api/school-trips/:id/consent` (per-student consent state).

## Analytics, reports, settings

`GET /api/analytics/overview?from&to`, `/api/analytics/punctuality`, `/api/analytics/utilisation`, `/api/analytics/driver-performance`; `GET/POST /api/reports`, `POST /api/reports/:id/run`; `GET/PATCH /api/settings` (school profile, session times, attendance rules, notification rules, retention).

## Parent app

`GET /api/parent/children`, `GET /api/parent/children/:id/today`, `GET /api/parent/children/:id/history?month`, `GET /api/parent/notifications?type`, `PATCH /api/parent/preferences`, `POST /api/parent/devices` (FCM token).

## Realtime

Socket.IO, path `/rt`, auth by the app's session cookie. Rooms: `school:<id>`, `bus:<id>`, `trip:<id>`, `student:<id>`. Server authorises room joins — a parent may join only `student:<theirChild>` and the `bus:<id>` their child is on, and only while that child's trip is active. Events are listed in README §5. Clients must re-fetch the REST snapshot after any reconnect.

## Errors

`400 VALIDATION` (with `fields`), `401 UNAUTHENTICATED`, `403 WRONG_APP` / `FORBIDDEN`, `404 NOT_FOUND`, `409 CONFLICT` (e.g. drop before board, double trip start), `429 RATE_LIMITED`, `500 INTERNAL`. Never leak whether a phone number or email exists.
