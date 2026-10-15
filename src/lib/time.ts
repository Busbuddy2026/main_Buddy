/**
 * Timestamps are stored in UTC and rendered in the school's timezone.
 * Calendar dates (a trip's day, an absence) are the school's local date,
 * stored as a Postgres `date` and carried around as "YYYY-MM-DD".
 */

export const SCHOOL_TZ = "Asia/Kolkata";

/** The school-local calendar date of an instant, as "YYYY-MM-DD". */
export function localDate(at: Date = new Date(), tz: string = SCHOOL_TZ): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** "YYYY-MM-DD" → the Date Prisma writes to a `@db.Date` column. */
export function dbDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** A `@db.Date` value back to "YYYY-MM-DD". */
export function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Shift a "YYYY-MM-DD" by whole days. */
export function addDays(day: string, n: number): string {
  const d = dbDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return dayOf(d);
}

/** "7:42 AM" in the school's timezone. */
export function formatTime(at: Date, tz: string = SCHOOL_TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

/** "8 Sep 2026" for a calendar day or an instant. */
export function formatDay(day: string | Date, tz: string = SCHOOL_TZ): string {
  const at = typeof day === "string" ? dbDate(day) : day;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: typeof day === "string" ? "UTC" : tz,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(at);
}

/** "8 September 2026", the long form the school-trip screens use. */
export function formatDayLong(day: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dbDate(day));
}

/** "Monday · 7 September", the parent history heading. */
export function formatWeekday(day: string): string {
  const at = dbDate(day);
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long" }).format(at);
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(at);
  return `${weekday} · ${date}`;
}

/** "07:24" (24-hour, as stored on a route stop) → "7:24 AM". */
export function clockLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "7:24 AM" → "07:24". Returns null when the label does not parse. */
export function parseClock(label: string): string | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*$/i.exec(label);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = match[3]?.toUpperCase();
  if (minute > 59 || hour > 23) return null;
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix === "PM" && hour !== 12) hour += 12;
    if (suffix === "AM" && hour === 12) hour = 0;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
