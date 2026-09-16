<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Greenfield Transport OS

School bus tracking, attendance, CCTV and safety. Three products share one
codebase and one database, all built: `admin.<domain>` at the root,
`parents.<domain>` at `/parent`, `crew.<domain>` at `/crew`. `src/proxy.ts`
rewrites each host onto its prefix.

Full brief `docs/handoff/README.md` · screens `docs/handoff/SCREENS.md` · API
`docs/handoff/API.md` · schema `docs/handoff/prisma/schema.prisma` · visual
prototypes `docs/handoff/design-reference/standalone/*.html`.

## Non-negotiables
1. **Three separate logins, three cookies** (`gf_admin`, `gf_parent`, `gf_crew`),
   scoped to their own subdomain. A session from one app must be rejected by the
   other two with a 403.
2. **Never copy the prototype HTML.** It is a visual reference. Build React
   components with Tailwind using the tokens in `src/app/globals.css`.
3. **Tenant scoping**: every query filters by `schoolId` taken from the session.
   Never accept `schoolId` from the client.
4. **The attendant app must work offline** — cached roster, queued marks,
   idempotent replay.
5. **Audit every write and every CCTV view.** This system holds children's
   location and video.
6. **Face recognition is out of scope.** Keep it as a disabled "coming soon"
   control.

## Conventions
- App Router, server components by default; `"use client"` only for interactive
  leaves.
- Next.js 16 renamed `middleware` to `proxy` — host routing for the three apps
  lives in `src/proxy.ts`, which also runs the Supabase session refresh. The
  cross-app 403 guard goes there once the three cookies exist.
- Each app owns its store under `src/lib/transport/`: `store.tsx` (admin),
  `parent-store.tsx`, `crew-store.tsx`. Shared mobile chrome is in
  `src/components/mobile/`.
- Design tokens live in `@theme` in `src/app/globals.css`. Cards use borders,
  never shadows; only two shadows exist (`--shadow-dropdown`, `--shadow-modal`).
  Colour signals status only. Every number, ID, plate and timestamp is
  `font-mono` (IBM Plex Mono).
- No `any`. No unhandled promise. No `console.log` in committed code.
- Timestamps stored UTC, rendered in the school's timezone (`Asia/Kolkata`).
- Seed data comes from the prototypes (6 buses, 4 routes, 15 stops, 8 students,
  5 drivers, 4 attendants, 3 school trips) — keep the same names so screenshots
  and specs line up.

## Working style
- Before building a screen, open its prototype in
  `docs/handoff/design-reference/standalone/` and match it.
- Follow the build order in `docs/handoff/README.md` §10. Do not start a phase
  before the previous one runs end to end against seeded data.
