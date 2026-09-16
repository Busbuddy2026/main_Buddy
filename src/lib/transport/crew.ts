/** Attendant app seed, lifted from docs/handoff/design-reference/Attendant App.dc.html. */

export const CREW = {
  name: "Suresh Kumar",
  initials: "SK",
  role: "Attendant · On duty",
  crewId: "GF-ATT-0142",
  phone: "+91 98490 44711",
  /** Demo credentials from the prototype (README §4). */
  demoPin: "1234",
  bus: "Bus 12",
  reg: "TS 09 UB 1234",
  driver: { name: "Ramesh Kumar", initials: "RK", phone: "+91 98490 33210" },
} as const;

export interface CrewStudent {
  id: string;
  name: string;
  cls: string;
  /** Key of the stop this student boards at in the morning. */
  stop: StopKey;
}

export type StopKey = "kondapur" | "botanical" | "greenvalley" | "gachibowli" | "school";

export const CREW_STUDENTS: CrewStudent[] = [
  { id: "vihaan", name: "Vihaan Mehta", cls: "Grade 4 · B", stop: "kondapur" },
  { id: "ishaan", name: "Ishaan Gupta", cls: "Grade 2 · C", stop: "kondapur" },
  { id: "diya", name: "Diya Sharma", cls: "Grade 3 · A", stop: "botanical" },
  { id: "rahul", name: "Rahul Reddy", cls: "Grade 8 · C", stop: "botanical" },
  { id: "aarav", name: "Aarav Kumar", cls: "Grade 5 · B", stop: "greenvalley" },
  { id: "myra", name: "Myra Nair", cls: "Grade 9 · B", stop: "greenvalley" },
  { id: "saanvi", name: "Saanvi Rao", cls: "Grade 7 · A", stop: "gachibowli" },
  { id: "ananya", name: "Ananya Patel", cls: "Grade 6 · A", stop: "gachibowli" },
];

export interface CrewStop {
  key: StopKey;
  name: string;
  short: string;
  time: string;
  /** Evening trips start by boarding everyone at school. */
  boarding?: boolean;
}

const MORNING: CrewStop[] = [
  { key: "kondapur", name: "Kondapur Main Road", short: "Kondapur", time: "7:05 AM" },
  { key: "botanical", name: "Botanical Garden", short: "Botanical", time: "7:15 AM" },
  { key: "greenvalley", name: "Green Valley Apartments", short: "Green Valley", time: "7:24 AM" },
  { key: "gachibowli", name: "Gachibowli Crossroads", short: "Gachibowli", time: "7:36 AM" },
  { key: "school", name: "Bharath Vidya Mandir", short: "School", time: "7:50 AM" },
];

const EVENING: CrewStop[] = [
  { key: "school", name: "Bharath Vidya Mandir", short: "School", time: "3:48 PM", boarding: true },
  { key: "gachibowli", name: "Gachibowli Crossroads", short: "Gachibowli", time: "4:06 PM" },
  { key: "greenvalley", name: "Green Valley Apartments", short: "Green Valley", time: "4:20 PM" },
  { key: "botanical", name: "Botanical Garden", short: "Botanical", time: "4:32 PM" },
  { key: "kondapur", name: "Kondapur Main Road", short: "Kondapur", time: "4:44 PM" },
];

export type TripPhase = "morning" | "evening";

/** School arrival is not a marking stop on the morning run. */
export const stopsFor = (trip: TripPhase): CrewStop[] =>
  trip === "evening" ? EVENING : MORNING.filter((s) => s.key !== "school");

export type MarkPhase = "board" | "drop";
export type MarkStatus = "boarded" | "dropped" | "absent";

export interface Mark {
  status: MarkStatus;
  stop: string;
  short: string;
  time: string;
}

/** Marks are keyed by `(phase, studentId)` so replaying a queue is idempotent. */
export const markKey = (phase: MarkPhase, studentId: string) => `${phase}:${studentId}`;

/** Students to mark at a stop — everyone when boarding at school, else that stop's group. */
export function studentsAt(stop: CrewStop): CrewStudent[] {
  return stop.boarding ? [...CREW_STUDENTS] : CREW_STUDENTS.filter((s) => s.stop === stop.key);
}

export const CREW_RECORDS = [
  { icon: "badge", label: "Police verification", sub: "Valid till 14 Mar 2027", status: "On file", bg: "#e6f4ea", fg: "#186c33" },
  { icon: "medical_services", label: "First aid training", sub: "Completed 2 Aug 2026", status: "Current", bg: "#e6f4ea", fg: "#186c33" },
  { icon: "description", label: "Aadhaar on record", sub: "Verified by transport office", status: "On file", bg: "#e6f4ea", fg: "#186c33" },
  { icon: "health_and_safety", label: "Medical checkup", sub: "Due 30 Sep 2026", status: "Due soon", bg: "#fef7e0", fg: "#8f5b00" },
];

export const CREW_WEEK_STATS = [
  { value: "9", label: "Trips run" },
  { value: "71", label: "Marks recorded" },
  { value: "0", label: "Incidents" },
];
