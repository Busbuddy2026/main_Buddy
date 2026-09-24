/**
 * Bus Buddy marketing copy and data.
 *
 * Lifted verbatim from the handoff reference (docs/handoff/bus-buddy/
 * source.dc.html). The copy is final — see the handoff README, "Fidelity" —
 * so treat edits here as content changes, not code changes.
 */

export interface Stop {
  x: number;
  y: number;
  name: string;
}

/** The 7-stop polyline the hero bus drives, in the map's 640×400 viewBox. */
export const ROUTE: Stop[] = [
  { x: 56, y: 336, name: "Depot" },
  { x: 150, y: 290, name: "Green Park" },
  { x: 232, y: 306, name: "Lake View" },
  { x: 318, y: 238, name: "Sector 9" },
  { x: 404, y: 252, name: "Rosewood" },
  { x: 498, y: 184, name: "Hillside" },
  { x: 580, y: 94, name: "School" },
];

export const ROUTE_PATH = ROUTE.map((s) => `${s.x} ${s.y}`).join(" L ");

export interface Notification {
  time: string;
  title: string;
  meta: string;
}

export const NOTIFICATIONS: Notification[] = [
  { time: "07:12", title: "Bus started from depot", meta: "Route 12 · Attendant Meera on board" },
  { time: "07:34", title: "Aarav boarded at Lake View", meta: "Confirmed by face recognition" },
  { time: "07:51", title: "Bus approaching school", meta: "2 stops away · on time" },
  { time: "08:02", title: "Dropped at school gate", meta: "38 of 38 students" },
];

export const SCHOOLS = [
  "Greenfield International",
  "St. Anne’s",
  "Vidya Mandir",
  "Orchid Public School",
  "Little Flower",
  "Harvest Academy",
];

export interface VisionCell {
  num: string;
  title: string;
  blurb: string;
}

export const VISION: VisionCell[] = [
  {
    num: "01",
    title: "Signal from the trip itself",
    blurb:
      "Every boarding, stop and delay is already happening. The bus should be recording it, not the office.",
  },
  {
    num: "02",
    title: "Parents get told, not asked",
    blurb:
      "Four moments — started, boarded, approaching, dropped — pushed without anyone making a call.",
  },
  {
    num: "03",
    title: "Identity, not a headcount",
    blurb:
      "Recognition at the door removes the gap between who was marked and who actually got on.",
  },
  {
    num: "04",
    title: "A record that survives the week",
    blurb:
      "Timestamps, alerts and footage kept so a school can answer any question, months later.",
  },
];

export interface PlatformTab {
  name: string;
  blurb: string;
  label: string;
  rows: Array<[string, string]>;
}

export const PLATFORM_TABS: PlatformTab[] = [
  {
    name: "Instrument the bus",
    blurb: "GPS, door camera and face terminal fitted per bus, verified on site.",
    label: "Instrument",
    rows: [
      ["GPS device", "online"],
      ["Door camera", "recording"],
      ["Face terminal", "ready"],
      ["Fire monitor", "ok"],
    ],
  },
  {
    name: "Watch the trip",
    blurb: "Live location, ETA, next stop and delay or deviation alerts as the trip runs.",
    label: "Watch",
    rows: [
      ["Route 12 · morning", "running"],
      ["Next stop", "Lake View"],
      ["ETA", "7 min"],
      ["Deviation", "none"],
    ],
  },
  {
    name: "Confirm who boarded",
    blurb: "Recognition at the door writes the attendance record and tells the parent.",
    label: "Confirm",
    rows: [
      ["Boarded", "24 / 38"],
      ["Auto-marked", "22"],
      ["Manual override", "2"],
      ["Parents notified", "24"],
    ],
  },
  {
    name: "Prove it later",
    blurb: "Exportable trip, attendance and alert history for the academic year.",
    label: "Prove",
    rows: [
      ["Trips archived", "1 240"],
      ["Alerts logged", "38"],
      ["Export", "CSV / PDF"],
      ["Retention", "academic year"],
    ],
  },
];

export type TrustIcon = "lock" | "eye" | "doc";

export interface TrustCard {
  icon: TrustIcon;
  title: string;
  blurb: string;
}

export const TRUST: TrustCard[] = [
  {
    icon: "lock",
    title: "You decide what is captured",
    blurb:
      "Face registration, cameras and fire monitoring are switched on per school, and a parent confirms before a child is enrolled in recognition.",
  },
  {
    icon: "eye",
    title: "Parents see their own child",
    blurb:
      "No student list, no other family’s stop, no shared location history. Camera access stays with authorised school staff.",
  },
  {
    icon: "doc",
    title: "The school owns the record",
    blurb:
      "Trip, attendance and alert data is retained for the academic year and exportable at any time, in full.",
  },
];

/** The Safety+ door sequence, one step highlighted at a time. */
export const FACE_STEPS = [
  "Face detected at door camera",
  "Matched — Aarav S., Grade 4B",
  "Attendance marked 07:34:12",
  "Parent notified on the app",
];

export interface Quote {
  text: string;
  who: string;
  where: string;
}

export const QUOTES: Quote[] = [
  {
    text:
      "The office used to take forty calls a morning asking where the bus was. Last month we took three.",
    who: "Transport head",
    where: "K–12 school · 14 buses",
  },
  {
    text:
      "Attendants stopped keeping a paper roll. The boarding record writes itself at the door now.",
    who: "Principal",
    where: "CBSE school · 9 buses",
  },
  {
    text:
      "I stopped standing at the gate guessing. I can see the bus, and I know the moment he is on it.",
    who: "Parent",
    where: "Grade 4 · Route 12",
  },
];

export interface Stat {
  /** Counted up from zero on reveal. */
  target: number;
  format: "int" | "seconds" | "percent1" | "percent0";
  label: string;
}

export const STATS: Stat[] = [
  { target: 1240, format: "int", label: "Trips tracked every morning" },
  { target: 3, format: "seconds", label: "Seconds from boarding to alert" },
  { target: 99.4, format: "percent1", label: "Attendance accuracy with face ID" },
  { target: 87, format: "percent0", label: "Parent questions answered in-app" },
];

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    q: "Who pays — the school or the parents?",
    a: "Parents are billed directly, per student per month. The school provides and manages the transport infrastructure and operational platform, and pays no licence fee.",
  },
  {
    q: "Can parents on different plans share a bus?",
    a: "Yes. Plans are per student, so a Basic parent and a Safety+ parent on the same route each see what they pay for. Attendant and school views are unaffected.",
  },
  {
    q: "What happens when a bus loses coverage?",
    a: "The attendant app keeps working offline and queues boarding records. Location and attendance sync when the bus is back in coverage, with original timestamps preserved.",
  },
  {
    q: "Is facial recognition mandatory?",
    a: "No. It sits in Safety+ and needs the school to opt in and the parent to register a face. Manual and stop-wise attendance remain available on every plan.",
  },
  {
    q: "How long until we go live?",
    a: "Around two weeks for a typical 10–15 bus fleet: route survey, hardware fitting, data import, staff training, then a parent launch.",
  },
  {
    q: "Where is safety data stored, and for how long?",
    a: "Trip, attendance and alert records are retained for the academic year and exportable by the school. Camera retention is configured per school at deployment.",
  },
];

export interface ProductModule {
  name: string;
  who: string;
  blurb: string;
  items: string[];
}

export const MODULES: ProductModule[] = [
  {
    name: "Parent app",
    who: "iOS · Android",
    blurb:
      "The daily view: where the bus is, whether the child boarded, and when they were dropped.",
    items: [
      "Live map, ETA and next stop",
      "Boarding, drop and approaching alerts",
      "Multiple children on one login",
      "Attendance and trip history",
      "Driver and attendant details",
    ],
  },
  {
    name: "Attendant app",
    who: "On the bus",
    blurb:
      "Built for one hand and a moving vehicle — big targets, few taps, offline-tolerant.",
    items: [
      "Stop-wise student list",
      "Manual boarded / absent marking",
      "Trip start and end",
      "Live trip, next stop, ETA",
      "SOS and emergency alert",
    ],
  },
  {
    name: "School console",
    who: "Web",
    blurb:
      "Students, parents, buses, drivers, attendants, routes, stops and trips in one place.",
    items: [
      "Route and stop management",
      "Bus, driver and attendant records",
      "Trip management and monitoring",
      "Transport attendance records",
      "Incident and alert log",
    ],
  },
  {
    name: "Safety layer",
    who: "On-device",
    blurb:
      "The part that removes human error — identification, recording and monitoring at the door.",
    items: [
      "Face registration and recognition",
      "Automatic boarding detection",
      "Attendance timestamps",
      "Live camera monitoring",
      "Route deviation and overspeed alerts",
    ],
  },
];

export const HARDWARE: Array<{ kind: string; blurb: string }> = [
  { kind: "GPS", blurb: "Real-time location, deviation and overspeed alerts" },
  { kind: "CAMERA", blurb: "Live monitoring, recording and status checks" },
  { kind: "FACE ID", blurb: "Registration, boarding detection, timestamps" },
  { kind: "FIRE", blurb: "Extinguisher checks and safety alerts" },
];

export interface Service {
  phase: string;
  name: string;
  blurb: string;
  tags: string[];
}

export const SERVICES: Service[] = [
  {
    phase: "Phase 01",
    name: "Route and stop survey",
    blurb:
      "We map your existing routes, stops and timings with your transport head before anything is switched on.",
    tags: ["Route mapping", "Stop timings", "Bus allocation"],
  },
  {
    phase: "Phase 02",
    name: "Hardware deployment",
    blurb:
      "GPS units, door cameras, face terminals and fire-safety monitoring fitted and verified bus by bus.",
    tags: ["GPS fitting", "Camera install", "Face terminal", "Verification"],
  },
  {
    phase: "Phase 03",
    name: "Data setup and migration",
    blurb:
      "Students, parents, staff and vehicle records imported from your existing sheets or ERP.",
    tags: ["Bulk import", "Parent mapping", "Staff accounts"],
  },
  {
    phase: "Phase 04",
    name: "Staff and parent onboarding",
    blurb:
      "Training for attendants and office staff, plus a parent launch kit that actually gets installs.",
    tags: ["Attendant training", "Console training", "Parent launch kit"],
  },
  {
    phase: "Phase 05",
    name: "Run and support",
    blurb:
      "A dedicated channel during school hours, monthly safety reports and quarterly route reviews.",
    tags: ["Priority support", "Safety reports", "Route reviews"],
  },
];

export const SLA: Array<{ value: string; label: string }> = [
  { value: "< 4 h", label: "Response on transport-blocking issues" },
  { value: "Monthly", label: "Safety report: alerts, deviations, gaps" },
  { value: "Quarterly", label: "Route review as enrolment changes" },
  { value: "2 days", label: "On-site hardware replacement visit" },
];

export type PlanId = "basic" | "smart" | "safety";

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  badge: string;
  pitch: string;
  highlights: string[];
  cta: string;
}

export const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    price: "129",
    badge: "Stay connected",
    pitch:
      "Know your child's transport status — bus, stop, staff and every boarding and drop.",
    highlights: [
      "Boarding & drop notifications",
      "Assigned bus, driver, attendant",
      "Transport & attendance history",
    ],
    cta: "Choose Basic",
  },
  {
    id: "smart",
    name: "Smart",
    price: "149",
    badge: "Most chosen",
    pitch:
      "See the bus live with GPS, ETA and next stop — plus delay, route-change and SOS alerts.",
    highlights: [
      "Live map, ETA, next stop",
      "Approaching & delay alerts",
      "Emergency alert and SOS",
    ],
    cta: "Choose Smart",
  },
  {
    id: "safety",
    name: "Safety+",
    price: "199",
    badge: "Complete safety",
    pitch: "AI-powered attendance plus on-bus camera and fire-safety capabilities.",
    highlights: [
      "Face-recognition boarding",
      "Live camera monitoring",
      "Overspeed, deviation, fire alerts",
    ],
    cta: "Choose Safety+",
  },
];

/** [capability, basic, smart, safety+] — 1 is included, 0 is not. */
export type FeatureRow = [string, 0 | 1, 0 | 1, 0 | 1];

export interface FeatureGroup {
  name: string;
  rows: FeatureRow[];
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    name: "Parent app",
    rows: [
      ["Parent login", 1, 1, 1],
      ["Child profile", 1, 1, 1],
      ["Multiple children", 1, 1, 1],
      ["Assigned bus details", 1, 1, 1],
      ["Driver details", 1, 1, 1],
      ["Attendant details", 1, 1, 1],
      ["Pickup / drop stop", 1, 1, 1],
      ["Transport notifications", 1, 1, 1],
      ["Boarding notification", 1, 1, 1],
      ["Drop notification", 1, 1, 1],
      ["Bus started notification", 1, 1, 1],
      ["Transport history", 1, 1, 1],
      ["Attendance history", 1, 1, 1],
    ],
  },
  {
    name: "Live tracking",
    rows: [
      ["Live bus location", 0, 1, 1],
      ["Live map", 0, 1, 1],
      ["Bus ETA", 0, 1, 1],
      ["Next stop", 0, 1, 1],
      ["Bus approaching alert", 0, 1, 1],
      ["Delay notification", 0, 1, 1],
      ["Route change notification", 0, 1, 1],
      ["Live trip status", 0, 1, 1],
    ],
  },
  {
    name: "Attendance",
    rows: [
      ["Manual attendance", 1, 1, 1],
      ["Boarding status", 1, 1, 1],
      ["Absent status", 1, 1, 1],
      ["Student boarding history", 1, 1, 1],
      ["Stop-wise attendance", 0, 1, 1],
      ["Automatic attendance", 0, 0, 1],
    ],
  },
  {
    name: "Facial recognition",
    rows: [
      ["Student face registration", 0, 0, 1],
      ["Face recognition", 0, 0, 1],
      ["Automatic student identification", 0, 0, 1],
      ["Automatic boarding detection", 0, 0, 1],
      ["Automatic attendance marking", 0, 0, 1],
      ["Attendance timestamp", 0, 0, 1],
      ["Parent attendance confirmation", 0, 0, 1],
    ],
  },
  {
    name: "Attendant app",
    rows: [
      ["Assigned bus", 1, 1, 1],
      ["Morning / evening trip", 1, 1, 1],
      ["Student list", 1, 1, 1],
      ["Stop-wise student list", 1, 1, 1],
      ["Manual boarded / absent", 1, 1, 1],
      ["Student count", 1, 1, 1],
      ["Trip start / end", 1, 1, 1],
      ["Live trip", 0, 1, 1],
      ["Next stop", 0, 1, 1],
      ["ETA", 0, 1, 1],
      ["Driver contact", 1, 1, 1],
      ["SOS / emergency alert", 0, 1, 1],
    ],
  },
  {
    name: "School / transport management",
    rows: [
      ["Student management", 1, 1, 1],
      ["Parent management", 1, 1, 1],
      ["Bus management", 1, 1, 1],
      ["Driver management", 1, 1, 1],
      ["Attendant management", 1, 1, 1],
      ["Route management", 1, 1, 1],
      ["Stop management", 1, 1, 1],
      ["Trip management", 1, 1, 1],
      ["Transport attendance records", 1, 1, 1],
    ],
  },
  {
    name: "GPS & vehicle safety",
    rows: [
      ["GPS device integration", 0, 1, 1],
      ["Real-time GPS tracking", 0, 1, 1],
      ["GPS device status", 0, 1, 1],
      ["Route deviation alert", 0, 0, 1],
      ["Overspeed alert", 0, 0, 1],
    ],
  },
  {
    name: "Camera & security",
    rows: [
      ["Bus camera setup", 0, 0, 1],
      ["Live camera monitoring", 0, 0, 1],
      ["Camera recording", 0, 0, 1],
      ["Camera status", 0, 0, 1],
    ],
  },
  {
    name: "Fire safety",
    rows: [
      ["Fire extinguisher", 0, 0, 1],
      ["Fire-safety monitoring", 0, 0, 1],
      ["Fire-safety alert", 0, 0, 1],
    ],
  },
  {
    name: "Safety & emergency",
    rows: [
      ["Emergency alert", 0, 1, 1],
      ["SOS", 0, 1, 1],
      ["Live emergency location", 0, 1, 1],
      ["Incident notification", 0, 0, 1],
      ["Safety monitoring", 0, 0, 1],
    ],
  },
];

export const PRINCIPLES: Array<{ num: string; title: string; blurb: string }> = [
  {
    num: "PRINCIPLE 01",
    title: "A notification beats a phone call",
    blurb: "If a parent has to ask, we failed. Every status moves to them automatically.",
  },
  {
    num: "PRINCIPLE 02",
    title: "The attendant's hands are full",
    blurb: "Anything the bus can record by itself shouldn't need a tap on a screen.",
  },
  {
    num: "PRINCIPLE 03",
    title: "Safety data is evidence",
    blurb:
      "Timestamps, footage and alerts are kept so the school can answer any question.",
  },
];

export const ADOPTION_STATS: Array<{ value: string; label: string }> = [
  { value: "₹0", label: "School licence fee" },
  { value: "3", label: "Parent plan tiers" },
  { value: "2 wks", label: "Typical go-live" },
];

export const TEAM: Array<{ name: string; role: string }> = [
  { name: "Name placeholder", role: "Founder" },
  { name: "Name placeholder", role: "Head of engineering" },
  { name: "Name placeholder", role: "School partnerships" },
  { name: "Name placeholder", role: "Deployment lead" },
];

export const MILESTONES: Array<{ when: string; what: string }> = [
  {
    when: "Year one",
    what: "First route instrumented with GPS and a parent app built around four notifications.",
  },
  {
    when: "Year two",
    what: "Attendant app rebuilt for one-handed use on a moving bus; offline boarding records.",
  },
  {
    when: "Year three",
    what: "Face-recognition boarding, on-bus cameras and fire-safety monitoring added as Safety+.",
  },
  { when: "Now", what: "Parent-paid plans, so a school can adopt without a budget line." },
];

export const INTERESTS = [
  "Live tracking",
  "Face-recognition attendance",
  "On-bus cameras",
  "Fire safety",
  "Parent onboarding",
];
