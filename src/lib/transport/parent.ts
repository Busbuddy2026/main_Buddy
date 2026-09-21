import { TONE, type Tone } from "./tone";

/** Parent app seed, lifted from docs/handoff/design-reference/Parent App.dc.html. */

export const PARENT = {
  name: "Arumugam R",
  initials: "AR",
  firstName: "Arumugam",
  phone: "9848012345",
  /** Demo credentials from the prototype (README §4). */
  demoOtp: "123456",
} as const;

export interface Child {
  first: string;
  name: string;
  initial: string;
  cls: string;
  roll: string;
  bus: string;
  stop: string;
}

export const CHILDREN: Child[] = [
  { first: "Aarav", name: "Aarav Kumar", initial: "A", cls: "Grade 5 · B", roll: "5B-14", bus: "BUS 12", stop: "Green Valley Apartments" },
  { first: "Diya", name: "Diya Sharma", initial: "D", cls: "Grade 3 · A", roll: "3A-07", bus: "BUS 12", stop: "Botanical Garden" },
];

export const PARENT_TABS = [
  { id: "home", label: "Home", icon: "home", href: "/parent" },
  { id: "track", label: "Track", icon: "near_me", href: "/parent/track" },
  { id: "alerts", label: "Alerts", icon: "notifications", href: "/parent/alerts" },
  { id: "history", label: "History", icon: "history", href: "/parent/history" },
  { id: "profile", label: "Profile", icon: "person", href: "/parent/profile" },
] as const;

/**
 * Time-of-day greeting on the parent home screen.
 *
 * Read in the school's timezone, not the device's — a parent travelling abroad
 * should still be greeted against the morning their child's bus is running.
 */
export function greetingFor(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export type JourneyState = "done" | "now" | "todo";

export function journeyFor(childFirst: string): Array<{
  title: string;
  time: string;
  state: JourneyState;
}> {
  return [
    { title: "Bus started from depot", time: "6:20 AM", state: "done" },
    { title: "Bus approaching your stop", time: "6:38 AM", state: "done" },
    { title: `${childFirst} boarded the bus`, time: "6:42 AM", state: "done" },
    { title: "On the way to school", time: "Now", state: "now" },
    { title: "Reached school", time: "7:50 AM", state: "todo" },
  ];
}

export const NOTIFICATION_FILTERS = ["All", "Transport", "Attendance", "Alerts"] as const;
export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number];

export interface ParentNotification {
  icon: string;
  title: string;
  body: string;
  time: string;
  bg: string;
  fg: string;
  kind: Exclude<NotificationFilter, "All">;
}

export function notificationsFor(childFirst: string): ParentNotification[] {
  return [
    { icon: "directions_bus", title: "Bus 12 has started", body: "Morning trip from Kondapur depot has begun.", time: "6:20 AM", bg: "#e8f0fe", fg: "#1558b8", kind: "Transport" },
    { icon: "near_me", title: "Bus is approaching your stop", body: "Green Valley Apartments in about 4 minutes.", time: "6:38 AM", bg: "#e8f0fe", fg: "#1558b8", kind: "Transport" },
    { icon: "how_to_reg", title: `${childFirst} boarded the bus`, body: "Marked by attendant Suresh Kumar at Green Valley Apartments.", time: "6:42 AM", bg: "#e6f4ea", fg: "#186c33", kind: "Attendance" },
    { icon: "school", title: `${childFirst} reached school safely`, body: "Bus 12 arrived at Bharath Vidya Mandir.", time: "7:35 AM", bg: "#e6f4ea", fg: "#186c33", kind: "Attendance" },
    { icon: "schedule", title: "Return bus delayed by 10 minutes", body: "Traffic near Gachibowli flyover. New arrival about 4:42 PM.", time: "Yesterday", bg: "#fef7e0", fg: "#8f5b00", kind: "Alerts" },
    { icon: "alt_route", title: "Route change for 10 September", body: "Road work on Botanical Garden road. Pickup moves 5 minutes earlier.", time: "Yesterday", bg: "#f1f3f4", fg: "#5f6672", kind: "Alerts" },
  ];
}

export interface HistoryDay {
  label: string;
  status: string;
  tone: Tone;
  rows: Array<{ time: string; label: string }>;
}

export const HISTORY_DAYS: HistoryDay[] = [
  {
    label: "Today · 8 September", status: "In progress", tone: TONE.ontime,
    rows: [
      { time: "6:42 AM", label: "Boarded bus at Green Valley Apartments" },
      { time: "7:35 AM", label: "Reached school" },
      { time: "3:48 PM", label: "Return trip scheduled" },
    ],
  },
  {
    label: "Monday · 7 September", status: "Completed", tone: TONE.good,
    rows: [
      { time: "6:40 AM", label: "Boarded bus" },
      { time: "7:32 AM", label: "Reached school" },
      { time: "3:48 PM", label: "Boarded return bus" },
      { time: "4:32 PM", label: "Dropped safely" },
    ],
  },
  {
    label: "Friday · 5 September", status: "Absent", tone: TONE.bad,
    rows: [
      { time: "6:35 AM", label: "Marked absent by attendant" },
      { time: "—", label: "Transport not used" },
    ],
  },
];

export const PARENT_CONTACTS = [
  { name: "School transport office", role: "Bharath Vidya Mandir", icon: "school", phone: "+91 40 2311 4500" },
  { name: "Suresh Kumar", role: "Attendant · Bus 12", icon: "badge", phone: "+91 98490 44120" },
  { name: "Ramesh Kumar", role: "Driver · Bus 12", icon: "directions_bus", phone: "+91 98490 33210" },
];

/** Preference toggles must actually gate sending once push is wired (README §7). */
export const PREFERENCE_ROWS = [
  { id: "alerts", label: "Boarding and drop alerts", sub: "Push notification at every scan" },
  { id: "absence", label: "Delay and route changes", sub: "When the bus runs late or reroutes" },
  { id: "digest", label: "Weekly summary", sub: "Friday evening recap of the week" },
] as const;

export type PreferenceId = (typeof PREFERENCE_ROWS)[number]["id"];

/** Format a 10-digit number as `98480 12345`. */
export const formatPhone = (digits: string): string =>
  digits.replace(/(\d{5})(\d+)/, "$1 $2");
