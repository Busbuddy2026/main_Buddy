# CLAUDE.md — Greenfield Transport OS

Copy this file to the root of the new repo. It is the standing brief for Claude Code.

## What this is
Three products on one Next.js codebase and one Postgres database:
`admin.<domain>` (school transport console), `parents.<domain>` (parent app), `crew.<domain>` (bus attendant app).
Full brief: `docs/handoff/README.md`, screens: `docs/handoff/SCREENS.md`, API: `docs/handoff/API.md`, schema: `docs/handoff/prisma/schema.prisma`, visual prototypes: `docs/handoff/design-reference/standalone/*.html`.

## Non-negotiables
1. **Three separate logins, three cookies** (`gf_admin`, `gf_parent`, `gf_crew`), scoped to their own subdomain. A session from one app must be rejected by the other two with a 403.
2. **Never copy the prototype HTML.** It is a visual reference. Build React components with Tailwind using the tokens below.
3. **Tenant scoping**: every query filters by `schoolId` taken from the session. Never accept `schoolId` from the client.
4. **The attendant app must work offline** — cached roster, queued marks, idempotent replay.
5. **Audit every write and every CCTV view.** This system holds children's location and video.
6. **Face recognition is out of scope.** Keep it as a disabled "coming soon" control.

## Tokens
```
canvas #f6f7f9 · surface #ffffff · line #e4e7eb (soft #eceef1, rule #f3f4f6)
ink #16181b · ink2 #3c4149 · muted #5f6672 · faint #8b919b · disabled #a8aeb7
primary #1a73e8 (hover #1558b8, tint #e8f0fe) · success #1e8e3e (tint #e6f4ea, text #186c33)
warning #f29900 (tint #fef7e0, text #8f5b00) · critical #d93025 (hover #b3261e, tint #fce8e6, text #c5221f)
neutral #9aa0a6 (tint #f1f3f4)
radius: chip 8 · control 10 · card 16 · mobile card 20 · pill 999
fonts: DM Sans (UI) · IBM Plex Mono (every number, ID, plate, timestamp)
icons: Material Symbols Rounded
```
Cards use borders, not shadows. Only two shadows exist: dropdown `0 10px 28px rgba(16,24,40,.14)`, modal `0 24px 60px rgba(16,24,40,.18)`. Colour signals status only. Attendant touch targets ≥ 48px.

## Conventions
- App Router, server components by default; `"use client"` only for interactive leaves.
- Data access lives in `packages/db` repository functions — no Prisma calls inside components.
- Zod schema per route handler, shared with the client form via `react-hook-form`.
- Server actions for simple mutations; REST routes for anything the mobile apps or devices call.
- Realtime client is a single provider per app; components subscribe by room.
- No `any`. No unhandled promise. No `console.log` in committed code.
- Money/time: all timestamps stored UTC, rendered in the school's timezone (`Asia/Kolkata` default).
- Tests: a Playwright spec per flow in README §11 must stay green.

## Working style
- Before building a screen, open its prototype in `docs/handoff/design-reference/standalone/` and match it.
- Follow the build order in README §10. Do not start a phase before the previous one runs end to end against seeded data.
- Seed data comes from the prototypes (6 buses, 4 routes, 15 stops, 8 students, 5 drivers, 4 attendants, 2 school trips) — keep the same names so screenshots and specs line up.
