# Screens

Reference prototypes: `design-reference/standalone/*.html`. Open them and click through while reading this.

Conventions used throughout: cards are `#fff` on `#f6f7f9`, `1px solid #e4e7eb`, radius 14–16. Table header row = 11/600/uppercase/`#8b919b`, 0.04–0.06em tracking, bottom border `#eceef1`; body rows 12.5–13px with `#f3f4f6` separators. Every table is horizontally scrollable with a `min-width` and every filtered table has an empty state ("No X match these filters" + "Clear filters" link). All numbers, IDs, plates and times are IBM Plex Mono.

---

# A. School Admin — `admin.<domain>`

## A0. Shell

- **Sidebar** 248px fixed, `#fff`, right border `#e4e7eb`. School crest + name at top, then nav. Nav rows 36–38px, radius 9, active = `#e8f0fe` bg + `#1558b8` text, hover `#f6f7f9`. Groups expand to show children indented 20px. Badge chips: red count pill (`#fce8e6`/`#d93025`, mono) for open items; grey `SOON` chip for unbuilt sections.
- **Nav tree** (id → label):
  - `overview` Overview
  - `live` Live Operations → Live Map, Active Trips (`trips`), Bus Monitoring (`monitor`)
  - `buses` Transport → Buses, Routes, Stops
  - `students` People → Students, Drivers, Attendants
  - `schooltrips` School Trips
  - `attendance` Attendance → Today's Attendance, Attendance History (`history`)
  - `cctv` CCTV & Safety `[2]` → Live CCTV, Recordings, Camera Health (`health`), Incidents
  - `analytics` Analytics → Transport Analytics, Driver Performance (`driverperf`), Reports
  - `optimize` Route Optimization `SOON`
  - `settings` Settings
- **Header** sticky, `#fff`, bottom border: page title (22/600/-0.02em) + subtitle (13/`#8b919b`), right side search, notifications, admin avatar menu. Subtitles per page carry live counts, e.g. Overview → "Tuesday, 8 September · 7:42 AM · Morning session"; Buses → "24 vehicles · 22 in service"; CCTV → "68 of 72 cameras online".
- **Content** padding 26px 28px 60px, vertical stack gap 14–22px.
- **Detail pages** (`bus`, `route`, `student`, `schooltrip`, `incident`) are pushed pages with a back link, not modals.

## A1. Overview
KPI row (4–5 cards): buses running, students onboard, attendance marked %, delays, open incidents — label 12/`#5f6672`, value 28/500 mono, delta line below. Then a two-column split: live map card (left, ~1.4fr) and an activity/alerts rail (right, 1fr) listing recent boardings, delays, SOS and camera faults with time stamps. Tweakable layout: KPIs-first vs map-first; rail left vs right.

## A2. Live Map (`live`)
Filter chips (all / on time / delayed / offline) above a full-height map card with bus markers, plus a scrollable "All buses" list card beside it (sticky header). Selecting a bus in the list focuses the marker and vice versa. Empty state when filters match nothing.

## A3. Active Trips (`trips`)
Table — `BUS | ROUTE | PROGRESS | STUDENTS | STATUS | ETA` (min-width 700). Progress is a thin bar with "3 of 5 stops". Status pill uses the Trip vocabulary. Row click → bus profile, Live Trip tab.

## A4. Bus Monitoring (`monitor`)
Card grid (`minmax(300px,1fr)`), one card per bus: bus number (mono), route, driver, speed, last ping, GPS pill, CCTV pill, students onboard.

## A5. Buses
Filters: search + status dropdown. Primary button "Add bus".
Table — `BUS | REGISTRATION | DRIVER | STUDENTS | GPS | CCTV | STATUS | ACTIONS` (min-width 806). Actions = edit (pencil) and delete (trash) 30px icon buttons.
Seed rows: 12 / TS 09 UB 1234 / Ramesh Kumar / On Time · 08 / TS 09 UB 0871 / Mahesh Yadav / Delayed 12 min · 21 / TS 09 UB 2109 / Imran Baig / On Time · 04 / TS 09 UB 0442 / Naveen Rao / GPS Offline · 17 / Idle · 09 / Unassigned / Maintenance.

## A6. Bus profile (`bus`)
Header card: bus number, registration, capacity, route, driver, attendant, status pill, quick actions.
Tabs: **Overview · Live Trip · Students · CCTV · History · Documents · Maintenance** (active tab = `#16181b` text with 2px underline; inactive `#5f6672`).
- Overview — 1.4fr/1fr split: telemetry + today's trip on the left, crew and safety record on the right.
- Live Trip — full-width map (520px) focused on this bus.
- Students — roster table of assigned students.
- Documents — compliance card (RC, insurance, fitness, permit, pollution) each with file name, size, expiry pill and upload/replace; when all valid show a green "All documents valid" banner (`#e6f4ea`).
- CCTV / History / Maintenance — currently placeholder empty states; build per §7 of the README.

## A7. Routes
Banner card linking to Route Optimization (coming soon). Table — `ROUTE | BUS | STOPS | STUDENTS | DISTANCE | DURATION | STATUS | ACTIONS` (min-width 812). Seed: R1 Kondapur→School (Bus 12, 5 stops, 42 students, 11.4 km, 45 min, Active); R2 Gachibowli→School; R3 Madhapur→School; R4 Kukatpally→School (Unassigned, Draft).

## A8. Route details (`route`)
Header card with route name, zone, bus, distance, duration, status. Below: ordered stop sequence (numbered, pickup and drop times, students per stop, landmark) and the assigned-student list. Stop reordering is drag-and-drop; saving recomputes times and geometry.

## A9. Stops
Search + route filter, card grid (`minmax(260px,1fr)`): stop name, route, pickup time, drop time, student count, landmark. "Add stop" primary button. Empty state when filtered out.

## A10. Students
Filters: search, bus dropdown, route dropdown. Table — `STUDENT | BUS | STOP | MORNING | EVENING | ACTIONS` (min-width 730), morning/evening are attendance pills. "Add student" primary.

## A11. Student transport profile (`student`)
1.35fr/1fr split. Left: identity card (avatar initial in `#e8f0fe`, name, grade, roll), today's journey timeline (boarded / onboard / dropped with times and stops), recent history. Right: parent/guardian contacts with call buttons, assigned bus/route/stop, absence requests.

## A12. School Trips (`schooltrips`)
List of excursions with name, destination, date, depart/return, teacher in charge, consent status, live status pill. "New school trip" primary.

## A13. School trip detail (`schooltrip`)
Configuration card (destination, date, depart 8:30 AM, return 2:30 PM, teacher, consent, notes), fleet table `# | BUS | DRIVER | ATTENDANT | STUDENTS` with add/remove rows, manifest, and live tracking while the trip runs.
Seed: T-1041 "Grade 6 science museum visit" → Birla Science Museum, 2 buses, On the way; T-1042 "Grade 9 inter-school sports meet" → Gachibowli Stadium, Scheduled, 21 of 24 consents.

## A14. Attendance Control Center (`attendance`)
Five KPI cards: expected, boarded, absent, pending, completion %. Filters: bus, trip (morning/evening), status. Table — `STUDENT | BUS | STOP | BOARDED | DROPPED | UPDATED` (min-width 750); times mono, statuses as pills. Updates arrive live over the socket (row highlights briefly on change). Export CSV.

## A15. Attendance History
Table — `DATE | EXPECTED | BOARDED | ABSENT | DROPPED | COMPLETION` (min-width 700); completion is a bar + percentage. Date-range picker and CSV/PDF export.

## A16. Drivers
Table — `DRIVER | BUS | LICENCE | TODAY | SAFETY SCORE | STATUS | ACTIONS` (min-width 866). Licence cell shows number (mono) plus validity pill; "Expires in 24 days" uses the warn tone. Safety score 0–100 with a small bar. Seed: Ramesh Kumar 94, Mahesh Yadav 81, Imran Baig 88 (licence expiring), Naveen Rao 76, Gopal Sharma 91.

## A17. Attendants
Table — `ATTENDANT | BUS | ROUTE | ATTENDANCE MARKED | STATUS | ACTIONS` (min-width 780). "Attendance marked" is `38 / 42` with a progress bar.

## A18. Live CCTV
Bus dropdown + view dropdown (single / 2×2 / 3×3). Dark video tiles (`#20232a`, 16:9) with a mono overlay label `Bus 12 · Cabin · 8 Sep 2026 · 08:15:04`, live/recording pill, fullscreen and snapshot buttons. Camera count label above the grid.

## A19. Recordings
Backup card: Google Drive connection state, "Back up to Drive" primary, table `DAY | BUS | CLIPS | SIZE | STATUS | GET` with download and drive-export icon buttons, plus the retention note: "Footage is retained on device for 30 days. Backed-up days are copied to the school's Drive folder and kept indefinitely."
Below: four filters (bus, day, camera, event type), a player (16:7 dark) and an event timeline — 8px track with coloured event dots positioned by time, and a grid of event cards (label + mono timestamp) below.

## A20. Camera Health
Four KPI cards: total 72, online 68 (green), offline 3 (red), recording issues 1 (amber). Then a card grid per bus: camera list with per-camera status, last seen, storage, firmware, and a "Raise ticket" action.

## A21. Incidents
Table — `ID | BUS | TYPE | DATE & TIME | SEVERITY | STATUS | ASSIGNED TO` (min-width 830). Row → incident detail.

## A22. Incident detail (`incident`)
Timeline of events, attached footage clips, severity, assignee, status stepper New → Under review → Investigating → Resolved → Closed, and a notes/resolution composer. Every status change is audit-logged with author and timestamp.

## A23. Transport Analytics
Bar/line charts: on-time performance by route, utilisation (seats used vs capacity), attendance completion trend, delay causes. Range selector (last 30 days default). Charts use the primary blue with neutral gridlines — no multi-hue palettes.

## A24. Driver Performance
Safety score leaderboard, violation trends (harsh braking, speeding, sharp turns), per-driver drill-down.

## A25. Reports
Scheduled and on-demand exports: daily attendance, monthly utilisation, incident log, document expiry. Each row: name, frequency, recipients, last run, "Run now" / "Download".

## A26. Route Optimization
Coming-soon page: explanatory card, feature list, disabled controls, `SOON` badge. No functionality.

## A27. Settings
Grouped rows (label + description + control): school profile, session times, attendance rules, notification rules (tag chips per event type), CCTV retention, Drive backup, roles & permissions, integrations. Face recognition row is present but locked with a `COMING SOON` badge and a disabled toggle.

## A28. Create / edit / delete dialogs
One shared modal: 520–560px, radius 16, shadow `0 24px 60px rgba(16,24,40,.18)`, title + close, stacked fields (label 12/600 above a 10px/12px input), footer with Cancel (secondary) and Save (primary). Entities and their fields: **Bus** (number, registration, capacity, driver, attendant, route), **Route** (name, assigned bus, zone, stops, notes), **Stop** (name, route, pickup, drop, landmark), **Student** (name, class, bus, route, stop, parent, phone), **Driver** (name, phone, licence no., expiry, bus), **Attendant** (name, phone, bus, route), **Trip** (name, destination, date, depart, return, teacher, notes).
Delete is a separate confirm dialog: "Delete Bus 12?" + consequence line + destructive button `#d93025`. Deletes are soft (`deletedAt`) and audit-logged.

---

# B. Parent App — `parents.<domain>` (mobile, 460×900 design frame)

Bottom tab bar, 5 tabs, 22px icons + 10.5px labels, active `#1a73e8`, inactive `#8b919b`. Hidden on the login screen.

## B1. Login
School crest, title "Bharath Vidya Mandir", sub "Track your child's bus, get boarding alerts and report transport absences." Step 1: mobile number with a custom on-screen numeric keypad (1–9, blank, 0, ⌫); CTA "Send OTP" enabled at 10 digits (disabled state `#f1f3f4`/`#8b919b`). Step 2: six OTP boxes (filled = `#1a73e8` border, `#f7faff` bg; error = `#f7c8c4`), "Verify and sign in", plus an "edit number" affordance. Demo credentials: `98480 12345` / `123456`.

## B2. Home
Child switcher chips when the parent has more than one child (seed: Aarav Kumar Grade 5·B, Diya Sharma Grade 3·A — both Bus 12). Status hero: bus number, current state, ETA to the child's stop. Today's journey timeline: bus started 6:20 AM → approaching your stop 6:38 AM → boarded 6:42 AM → arrived at school, with done/current/upcoming states. Quick actions: track live, report absence, call attendant.

## B3. Track
Live map with the bus marker and the child's stop, ETA banner, driver and attendant cards with call buttons, and stop sequence with times. Updates over the socket.

## B4. Alerts
Filter chips All / Transport / Attendance / Alerts (active chip = `#16181b` bg, white text). Notification rows: round tinted icon, title, body, time. Seeded examples: "Bus 12 has started" 6:20 AM, "Bus is approaching your stop — Green Valley Apartments in about 4 minutes" 6:38 AM, boarding confirmation, delay notice.

## B5. History
Day-grouped cards ("Today · 8 September" with an In progress pill), each listing timestamped events ("6:42 AM Boarded bus at Green Valley Apartments"). Infinite scroll by month.

## B6. Report absence
Reached from Home. Choose child, date, morning/evening/both toggles, reason, confirm. Sends to the admin and to the attendant's roster for that trip; parent sees the confirmed state and can cancel before the trip starts.

## B7. Profile
Children cards (name, class, roll, bus, stop), contacts (school transport office, attendant Suresh Kumar, driver Ramesh Kumar) with call buttons, notification preference toggles (boarding and drop alerts / delay and route changes / weekly summary), account rows (language, registered number, help, privacy), sign out with a confirm sheet.

---

# C. Attendant App — `crew.<domain>` (mobile, 460×900 design frame)

Designed for one-handed use in a moving bus: primary targets ≥ 48px, high contrast, no small tap targets.

## C1. Login
Step 1 crew ID (`GF-ATT-0142`), step 2 four PIN boxes, same numeric keypad. Wrong PIN shows the error border and clears. Demo PIN `1234`.

## C2. Home
Crew name and bus, today's trip card (Morning trip · Kondapur → School), route, stop count, student count, clock. Footer: full-width "Start trip" primary (18px vertical padding, radius 16).

## C3. Stop / marking (`stop`)
- Stop chips strip across the top: numbered `01…05`, short name, and meta ("12 pending", "all marked", "no students"); current chip = blue border + `#f7faff`.
- View switch: **Students** | **Route**.
- Roster cards, one per student at this stop: avatar initial, name, class or status line, primary button "Boarded" (evening: "Mark dropped"), secondary "Absent", and after marking a settled state showing "Boarded at Green Valley · 7:24 AM" with **Undo**.
- Evening drop is blocked for students who never boarded — card is muted with "Not boarded yet" / "Marked absent at school" in amber.
- Footer: red 74px **SOS** button + pending count + "Next stop" primary. SOS opens a confirm and then a red armed banner: "Emergency alert sent — School office, transport manager and parents of onboard students notified. Live location and cabin camera shared." with a Cancel action.
- Morning trip stops: Kondapur Main Road 7:05, Botanical Garden 7:15, Green Valley Apartments 7:24, Gachibowli Crossroads 7:36 (school arrival 7:50 is not a marking stop). Evening reverses, starting with boarding at school 3:48 PM, then drops at 4:06 / 4:20 / 4:32 / 4:44.

## C4. Trip summary
Totals (marked, pending, absent), then per-stop sections listing each student with "Boarded 7:24", "Absent" or "Pending" in the matching tone. Footer "Complete trip" is disabled while anything is pending and shows the pending count.

## C5. Profile
Crew identity, bus and route, today's stats, language, help, sign out confirm.

## C6. Offline behaviour (build requirement, not in the prototype)
The trip roster is cached on trip start. Marks made offline are queued with their local timestamp, shown with a small "queued" indicator, and flushed in order on reconnect; the server accepts idempotent marks keyed by `(tripId, studentId, phase)`.
