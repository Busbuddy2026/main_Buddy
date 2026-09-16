import type {
  Attendant,
  Bus,
  BusDocuments,
  BusTelemetry,
  Driver,
  Route,
  SchoolTrip,
  Stop,
  Student,
  TransportData,
} from "./types";

/**
 * Seed data lifted verbatim from the design prototype
 * (docs/handoff/design-reference/School Admin.dc.html) so screenshots, specs and
 * the Playwright scenario in README §11 line up: 6 buses, 4 routes, 15 stops,
 * 8 students, 5 drivers, 4 attendants, 3 school trips.
 */

export const SCHOOL = {
  name: "Bharath Vidya Mandir",
  product: "Transport OS",
  user: "Arumugam K.",
  userInitials: "AK",
  userRole: "Transport Manager",
  firstName: "Arumugam",
} as const;

const buses: Bus[] = [
  { id: "12", reg: "TS 09 UB 1234", cap: "42", driver: "Ramesh Kumar", attendant: "Suresh Kumar", route: "Kondapur → School", onboard: 38, kind: "ontime", status: "On Time" },
  { id: "08", reg: "TS 09 UB 0871", cap: "40", driver: "Mahesh Yadav", attendant: "Kavitha Rani", route: "Gachibowli → School", onboard: 31, kind: "delayed", status: "Delayed 12 min" },
  { id: "21", reg: "TS 09 UB 2109", cap: "48", driver: "Imran Baig", attendant: "Suresh Naik", route: "Madhapur → School", onboard: 44, kind: "ontime", status: "On Time" },
  { id: "04", reg: "TS 09 UB 0442", cap: "42", driver: "Naveen Rao", attendant: "Latha Devi", route: "Kondapur → School", onboard: 0, kind: "offline", status: "GPS Offline" },
  { id: "17", reg: "TS 09 UB 1707", cap: "36", driver: "Gopal Sharma", attendant: "Rekha Bai", route: "Kukatpally → School", onboard: 0, kind: "offline", status: "Idle" },
  { id: "09", reg: "TS 09 UB 0912", cap: "42", driver: "Unassigned", attendant: "Unassigned", route: "—", onboard: 0, kind: "offline", status: "Maintenance" },
];

const routes: Route[] = [
  { id: "R1", name: "Kondapur → School", bus: "Bus 12", zone: "West Hyderabad", stopCount: "5", students: "42", km: "11.4 km", dur: "45 min", kind: "good", status: "Active" },
  { id: "R2", name: "Gachibowli → School", bus: "Bus 08", zone: "West Hyderabad", stopCount: "3", students: "40", km: "8.2 km", dur: "38 min", kind: "good", status: "Active" },
  { id: "R3", name: "Madhapur → School", bus: "Bus 21", zone: "Central", stopCount: "4", students: "48", km: "13.1 km", dur: "52 min", kind: "good", status: "Active" },
  { id: "R4", name: "Kukatpally → School", bus: "Unassigned", zone: "North", stopCount: "6", students: "0", km: "16.8 km", dur: "58 min", kind: "offline", status: "Draft" },
];

const stops: Stop[] = [
  { id: "S1", name: "Kondapur Main Road", route: "Kondapur → School", time: "7:05 AM", drop: "4:44 PM", students: "12 students", landmark: "Near Botanical Garden Road" },
  { id: "S2", name: "Botanical Garden", route: "Kondapur → School", time: "7:15 AM", drop: "4:32 PM", students: "9 students", landmark: "Main gate" },
  { id: "S3", name: "Green Valley Apartments", route: "Kondapur → School", time: "7:24 AM", drop: "4:20 PM", students: "11 students", landmark: "Opposite HDFC Bank" },
  { id: "S4", name: "Gachibowli Crossroads", route: "Kondapur → School", time: "7:36 AM", drop: "4:06 PM", students: "10 students", landmark: "Under the flyover" },
  { id: "S5", name: "Bharath Vidya Mandir", route: "Kondapur → School", time: "7:50 AM", drop: "3:48 PM", students: "Arrival", landmark: "Campus gate 2" },
  { id: "S6", name: "Lanco Hills", route: "Gachibowli → School", time: "7:12 AM", drop: "4:34 PM", students: "14 students", landmark: "Tower 4 gate" },
  { id: "S7", name: "Nanakramguda Junction", route: "Gachibowli → School", time: "7:26 AM", drop: "4:18 PM", students: "13 students", landmark: "Beside Wells Fargo" },
  { id: "S8", name: "HITEC City MMTS", route: "Madhapur → School", time: "7:08 AM", drop: "4:40 PM", students: "16 students", landmark: "Station forecourt" },
  { id: "S9", name: "Madhapur Police Station", route: "Madhapur → School", time: "7:18 AM", drop: "4:26 PM", students: "15 students", landmark: "Opposite Inorbit Mall" },
  { id: "S10", name: "Ayyappa Society", route: "Madhapur → School", time: "7:30 AM", drop: "4:12 PM", students: "17 students", landmark: "Near community hall" },
  { id: "S11", name: "Kukatpally Y Junction", route: "Unassigned", time: "6:52 AM", drop: "4:52 PM", students: "0 students", landmark: "Under the metro pillar 312" },
  { id: "S12", name: "JNTU Metro Station", route: "Unassigned", time: "7:02 AM", drop: "4:44 PM", students: "0 students", landmark: "Exit B" },
  { id: "S13", name: "Nizampet Crossroads", route: "Unassigned", time: "7:14 AM", drop: "4:32 PM", students: "0 students", landmark: "Beside Ratnadeep" },
  { id: "S14", name: "Bachupally Road", route: "Unassigned", time: "7:24 AM", drop: "4:20 PM", students: "0 students", landmark: "Opposite water tank" },
  { id: "S15", name: "Miyapur X Roads", route: "Unassigned", time: "7:34 AM", drop: "4:08 PM", students: "0 students", landmark: "Metro gate 1" },
];

const students: Student[] = [
  { id: "ST1", name: "Aarav Kumar", cls: "Grade 5 · B", bus: "Bus 12", route: "Kondapur → School", stop: "Green Valley Apartments", parent: "Rajesh Kumar", phone: "+91 98490 21145", am: "Boarded", pm: "Pending", updated: "6:42 AM" },
  { id: "ST2", name: "Diya Sharma", cls: "Grade 3 · A", bus: "Bus 12", route: "Kondapur → School", stop: "Botanical Garden", parent: "Anil Sharma", phone: "+91 98490 55231", am: "Boarded", pm: "Pending", updated: "7:14 AM" },
  { id: "ST3", name: "Rahul Reddy", cls: "Grade 8 · C", bus: "Bus 08", route: "Gachibowli → School", stop: "Lanco Hills", parent: "Sunil Reddy", phone: "+91 98490 77410", am: "Absent", pm: "Absent", updated: "—" },
  { id: "ST4", name: "Ananya Patel", cls: "Grade 6 · A", bus: "Bus 21", route: "Madhapur → School", stop: "HITEC City MMTS", parent: "Nikhil Patel", phone: "+91 98490 66123", am: "Boarded", pm: "Pending", updated: "7:02 AM" },
  { id: "ST5", name: "Vihaan Mehta", cls: "Grade 4 · B", bus: "Bus 12", route: "Kondapur → School", stop: "Kondapur Main Road", parent: "Kunal Mehta", phone: "+91 98490 31882", am: "Boarded", pm: "Pending", updated: "7:06 AM" },
  { id: "ST6", name: "Saanvi Rao", cls: "Grade 7 · A", bus: "Bus 21", route: "Madhapur → School", stop: "Lanco Hills", parent: "Prakash Rao", phone: "+91 98490 90233", am: "Pending", pm: "Pending", updated: "—" },
  { id: "ST7", name: "Ishaan Gupta", cls: "Grade 2 · C", bus: "Bus 08", route: "Gachibowli → School", stop: "Gachibowli Crossroads", parent: "Vikas Gupta", phone: "+91 98490 12094", am: "Boarded", pm: "Pending", updated: "7:21 AM" },
  { id: "ST8", name: "Myra Nair", cls: "Grade 9 · B", bus: "Bus 12", route: "Kondapur → School", stop: "Green Valley Apartments", parent: "Suresh Nair", phone: "+91 98490 48810", am: "Boarded", pm: "Pending", updated: "7:26 AM" },
];

const drivers: Driver[] = [
  { id: "DR1", name: "Ramesh Kumar", bus: "Bus 12", phone: "+91 98490 33210", licence: "TS 0220190004512", expiry: "14 Mar 2029", licenceDoc: "ramesh-kumar-licence.pdf · 386 KB", today: "On trip · Morning", score: 94, kind: "good", status: "On duty", licKind: "good", licLabel: "Valid · 2029" },
  { id: "DR2", name: "Mahesh Yadav", bus: "Bus 08", phone: "+91 98490 33845", licence: "TS 0220170002214", expiry: "02 Jul 2027", today: "On trip · Morning", score: 81, kind: "good", status: "On duty", licKind: "good", licLabel: "Valid · 2027" },
  { id: "DR3", name: "Imran Baig", bus: "Bus 21", phone: "+91 98490 71229", licence: "TS 0220160009087", expiry: "30 Sep 2026", licenceDoc: "imran-baig-licence.pdf · 412 KB", today: "On school trip", score: 88, kind: "good", status: "On duty", licKind: "delayed", licLabel: "Expires in 24 days" },
  { id: "DR4", name: "Naveen Rao", bus: "Bus 04", phone: "+91 98490 55008", licence: "TS 0220180003341", expiry: "11 Jan 2028", today: "Not started", score: 76, kind: "offline", status: "Idle", licKind: "good", licLabel: "Valid · 2028" },
  { id: "DR5", name: "Gopal Sharma", bus: "Bus 17", phone: "+91 98490 20114", licence: "TS 0220200006612", expiry: "22 Apr 2030", today: "Off duty", score: 91, kind: "offline", status: "Off duty", licKind: "good", licLabel: "Valid · 2030" },
];

const attendants: Attendant[] = [
  { id: "AT1", name: "Suresh Kumar", bus: "Bus 12", route: "Kondapur → School", phone: "+91 98490 44120", done: 38, total: 42, kind: "good", status: "Marking" },
  { id: "AT2", name: "Kavitha Rani", bus: "Bus 08", route: "Gachibowli → School", phone: "+91 98490 44231", done: 31, total: 40, kind: "good", status: "Marking" },
  { id: "AT3", name: "Suresh Naik", bus: "Bus 21", route: "Madhapur → School", phone: "+91 98490 44890", done: 44, total: 48, kind: "good", status: "Marking" },
  { id: "AT4", name: "Latha Devi", bus: "Bus 04", route: "Kondapur → School", phone: "+91 98490 44712", done: 0, total: 42, kind: "offline", status: "Not started" },
];

const trips: SchoolTrip[] = [
  {
    id: "T-1041", name: "Grade 6 science museum visit", destination: "Birla Science Museum, Naubat Pahad",
    date: "8 September 2026", depart: "8:30 AM", ret: "2:30 PM", teacher: "Meera Krishnan",
    consent: "All received", notes: "Packed lunch, return via Banjara Hills", kind: "ontime", status: "On the way",
    fleet: [
      { id: "F1", bus: "Bus 21", driver: "Imran Baig", attendant: "Suresh Naik", students: "44" },
      { id: "F2", bus: "Bus 12", driver: "Ramesh Kumar", attendant: "Suresh Kumar", students: "38" },
    ],
  },
  {
    id: "T-1042", name: "Grade 9 inter-school sports meet", destination: "Gachibowli Stadium",
    date: "12 September 2026", depart: "7:00 AM", ret: "5:00 PM", teacher: "Arun Prasad",
    consent: "21 of 24 received", notes: "Sports kit in cargo hold", kind: "delayed", status: "Scheduled",
    fleet: [{ id: "F3", bus: "Bus 12", driver: "Ramesh Kumar", attendant: "Suresh Kumar", students: "24" }],
  },
  {
    id: "T-1039", name: "Grade 4 zoo excursion", destination: "Nehru Zoological Park",
    date: "2 September 2026", depart: "8:00 AM", ret: "3:00 PM", teacher: "Divya Menon",
    consent: "All received", notes: "", kind: "good", status: "Completed",
    fleet: [
      { id: "F4", bus: "Bus 17", driver: "Gopal Sharma", attendant: "Rekha Bai", students: "41" },
      { id: "F5", bus: "Bus 04", driver: "Naveen Rao", attendant: "Latha Devi", students: "39" },
      { id: "F6", bus: "Bus 08", driver: "Mahesh Yadav", attendant: "Kavitha Rani", students: "36" },
    ],
  },
];

export const SEED: TransportData = { buses, routes, stops, students, drivers, attendants, trips };

/** Live telemetry for the four buses currently running a trip. */
export const BUS_TELEMETRY: Record<string, BusTelemetry> = {
  "12": { id: "12", reg: "TS 09 UB 1234", route: "Kondapur → School", routeId: "R1", status: "On Time", kind: "ontime", driver: "Ramesh Kumar", attendant: "Suresh Kumar", students: 38, cap: 42, speed: 32, stop: "Botanical Garden", next: "Green Valley Apartments", eta: "7 min", progress: 62, gps: "Strong", cam: "3 / 3 live" },
  "08": { id: "08", reg: "TS 09 UB 0871", route: "Gachibowli → School", routeId: "R2", status: "Delayed 12 min", kind: "delayed", driver: "Mahesh Yadav", attendant: "Kavitha Rani", students: 31, cap: 40, speed: 12, stop: "Lanco Hills", next: "Nanakramguda Junction", eta: "19 min", progress: 34, gps: "Strong", cam: "2 / 3 live" },
  "21": { id: "21", reg: "TS 09 UB 2109", route: "Madhapur → School", routeId: "R3", status: "On Time", kind: "ontime", driver: "Imran Baig", attendant: "Suresh Naik", students: 44, cap: 48, speed: 28, stop: "HITEC City MMTS", next: "Lanco Hills", eta: "11 min", progress: 74, gps: "Strong", cam: "3 / 3 live" },
  "04": { id: "04", reg: "TS 09 UB 0442", route: "Kondapur → School", routeId: "R1", status: "GPS Offline", kind: "offline", driver: "Naveen Rao", attendant: "Latha Devi", students: 0, cap: 42, speed: 0, stop: "—", next: "Kondapur Main Road", eta: "Unknown", progress: 8, gps: "Offline 6 min", cam: "3 / 3 live" },
};

/** Compliance documents required on every bus (README §7). */
export const REQUIRED_DOCS = [
  { key: "rc", label: "Registration certificate (RC)", note: "Vehicle ownership proof" },
  { key: "fitness", label: "Fitness certificate", note: "Annual roadworthiness" },
  { key: "insurance", label: "Insurance policy", note: "Comprehensive cover" },
  { key: "permit", label: "School bus permit", note: "State transport authority" },
  { key: "puc", label: "PUC certificate", note: "Emission compliance" },
  { key: "speed", label: "Speed governor certificate", note: "Sealed at 50 km/h" },
] as const;

export const BUS_DOCS: BusDocuments = {
  "12": {
    rc: { file: "ts09ub1234-rc.pdf", size: "1.2 MB", on: "12 Jan 2026", exp: "—" },
    fitness: { file: "fitness-2026.pdf", size: "640 KB", on: "14 Mar 2026", exp: "14 Mar 2027" },
    insurance: { file: "insurance-policy.pdf", size: "890 KB", on: "02 Jan 2026", exp: "02 Jan 2027" },
    permit: { file: "school-permit.pdf", size: "410 KB", on: "08 Feb 2026", exp: "08 Feb 2027" },
    puc: { file: "puc-sep.pdf", size: "210 KB", on: "01 Sep 2026", exp: "01 Mar 2027" },
  },
  "08": {
    rc: { file: "ts09ub0871-rc.pdf", size: "1.1 MB", on: "20 Nov 2025", exp: "—" },
    insurance: { file: "insurance-0871.pdf", size: "870 KB", on: "19 Feb 2026", exp: "19 Feb 2027" },
  },
  "21": {
    rc: { file: "ts09ub2109-rc.pdf", size: "1.3 MB", on: "05 Aug 2025", exp: "—" },
    fitness: { file: "fitness-2109.pdf", size: "620 KB", on: "22 Apr 2026", exp: "22 Apr 2027" },
    insurance: { file: "insurance-2109.pdf", size: "910 KB", on: "11 Mar 2026", exp: "11 Mar 2027" },
    permit: { file: "permit-2109.pdf", size: "430 KB", on: "30 Jan 2026", exp: "30 Jan 2027" },
    puc: { file: "puc-2109.pdf", size: "220 KB", on: "18 Aug 2026", exp: "18 Feb 2027" },
    speed: { file: "governor-2109.pdf", size: "180 KB", on: "02 Sep 2026", exp: "02 Sep 2027" },
  },
  "04": {},
  "17": { rc: { file: "ts09ub1707-rc.pdf", size: "1.0 MB", on: "14 Jun 2025", exp: "—" } },
  "09": {},
};
