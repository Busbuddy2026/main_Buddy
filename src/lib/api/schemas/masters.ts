import { z } from "zod";
import { parseClock } from "@/lib/time";

/**
 * Create/update payloads for the master records (API.md, "Masters").
 * The admin dialogs build these from their form values
 * (src/lib/transport/payloads.ts); the API parses them with the same schemas.
 *
 * References are database ids. An empty string means "Unassigned".
 */

const ref = z
  .string()
  .max(40)
  .transform((v) => v.trim() || null)
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const text = (label: string, max = 120) =>
  z.string().trim().min(1, `Enter the ${label}.`).max(max, `Keep the ${label} under ${max} characters.`);

const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

/** "7:24 AM" or "07:24" → "07:24". */
export const clock = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const parsed = parseClock(v);
      if (!parsed) {
        ctx.addIssue({ code: "custom", message: `Enter the ${label} like 7:24 AM.` });
        return z.NEVER;
      }
      return parsed;
    });

/** Indian mobile number, stored as E.164. */
const mobile = z
  .string()
  .transform((v) => v.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number."))
  .transform((v) => `+91${v}`);

/** "14 Mar 2029", "2029-03-14", … → "YYYY-MM-DD". */
const calendarDay = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
      const parsed = new Date(iso ? `${iso}T00:00:00Z` : `${v} 00:00:00 UTC`);
      if (!v || Number.isNaN(parsed.getTime())) {
        ctx.addIssue({ code: "custom", message: `Enter the ${label} like 14 Mar 2029.` });
        return z.NEVER;
      }
      return parsed.toISOString().slice(0, 10);
    });

const count = (label: string, max: number) =>
  z.coerce
    .number({ error: `Enter the ${label} as a number.` })
    .int(`Enter the ${label} as a whole number.`)
    .min(0)
    .max(max);

export const busSchema = z.object({
  /** GPS/dashcam tracker from the school's LivePin account; null unlinks, omitted leaves as is. */
  tracker: z.object({ vehicleId: z.string().max(40).nullable() }).optional(),
  number: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,6}$/, "Use the bus number painted on the bus, like 12."),
  registration: text("registration number", 20).transform((v) => v.toUpperCase()),
  capacity: count("capacity", 90).refine((n) => n > 0, "Capacity must be at least 1."),
  driverId: ref,
  attendantId: ref,
  routeId: ref,
});

/** "Grade 5 · B" → grade "Grade 5", section "B". */
const gradeSection = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const [grade, section] = v.split(/\s*[·\-/,]\s*/);
    if (!grade || !section) {
      ctx.addIssue({ code: "custom", message: "Enter class and section like Grade 5 · B." });
      return z.NEVER;
    }
    return { grade: /^\d+$/.test(grade) ? `Grade ${grade}` : grade, section: section.toUpperCase() };
  });

/** Blank or "—" (an empty field on the form) counts as not given. */
const blank = (v: unknown) => (typeof v === "string" && /^\s*—?\s*$/.test(v) ? undefined : v);

export const studentSchema = z
  .object({
    name: text("full name"),
    cls: gradeSection,
    roll: optionalText(20),
    busId: ref,
    routeId: ref,
    stopId: ref,
    /** The parent's mobile is their login. Optional: a student can wait for a confirmed number. */
    parentName: z.preprocess(blank, text("parent name").optional()),
    parentPhone: z.preprocess(blank, mobile.optional()),
    /** A number not yet confirmed as a parent's. Kept for the office, never a login. */
    contactPhone: z.preprocess(blank, mobile.optional()),
  })
  .superRefine((s, ctx) => {
    if (s.parentPhone && !s.parentName) ctx.addIssue({ code: "custom", path: ["parentName"], message: "Enter the parent's name." });
    if (s.parentName && !s.parentPhone) ctx.addIssue({ code: "custom", path: ["parentPhone"], message: "Enter the parent's mobile." });
  });

export const driverSchema = z.object({
  name: text("full name"),
  phone: mobile,
  licenceNo: text("licence number", 30).transform((v) => v.toUpperCase()),
  licenceExpiry: calendarDay("licence expiry"),
  busId: ref,
});

export const attendantSchema = z.object({
  name: text("full name"),
  phone: mobile,
  busId: ref,
});

export const routeStopSchema = z.object({
  /** An existing stop; omitted to create a new one with `name`. */
  stopId: ref,
  name: text("stop name"),
  pickup: clock("pickup time"),
  drop: clock("drop time"),
  landmark: optionalText(),
});

/** "11.4 km" → metres; "45 min" → seconds. */
const distance = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    const n = Number.parseFloat(v ?? "");
    return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null;
  });
const duration = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    const n = Number.parseFloat(v ?? "");
    return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : null;
  });

export const routeSchema = z.object({
  name: text("route name"),
  zone: optionalText(80),
  busId: ref,
  distance,
  duration,
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
  stops: z
    .array(routeStopSchema)
    .max(60)
    .superRefine((stops, ctx) => {
      const seen = new Set<string>();
      stops.forEach((s, i) => {
        const key = s.stopId ?? s.name.toLowerCase();
        if (seen.has(key)) {
          ctx.addIssue({ code: "custom", path: [i, "name"], message: "This stop is already on the route." });
        }
        seen.add(key);
      });
    }),
});

export const stopSchema = z.object({
  name: text("stop name"),
  landmark: optionalText(),
  routeId: ref,
  pickup: clock("pickup time").optional(),
  drop: clock("drop time").optional(),
  /** Students who board here. Replaces the stop's current list. */
  studentIds: z.array(z.string().max(40)).max(500),
});

export const fleetRowSchema = z.object({
  busId: z.string().min(1, "Pick a bus."),
  driverId: ref,
  attendantId: ref,
  studentCount: count("student count", 120),
});

export const schoolTripSchema = z.object({
  name: text("trip name"),
  destination: text("destination", 200),
  date: calendarDay("date"),
  departTime: clock("departure time"),
  returnTime: clock("return time"),
  teacherName: text("teacher in charge"),
  notes: optionalText(500),
  status: z
    .enum(["DRAFT", "SCHEDULED", "ON_THE_WAY", "AT_VENUE", "RETURNING", "COMPLETED", "CANCELLED"])
    .optional(),
  fleet: z
    .array(fleetRowSchema)
    .max(20)
    .superRefine((rows, ctx) => {
      const seen = new Set<string>();
      rows.forEach((r, i) => {
        if (seen.has(r.busId)) {
          ctx.addIssue({ code: "custom", path: [i, "busId"], message: "This bus is already on the trip." });
        }
        seen.add(r.busId);
      });
    }),
});

export const moveStopSchema = z.object({
  stopId: z.string().min(1),
  dir: z.union([z.literal(-1), z.literal(1)]),
});

export type BusInput = z.infer<typeof busSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
export type DriverInput = z.infer<typeof driverSchema>;
export type AttendantInput = z.infer<typeof attendantSchema>;
export type RouteInput = z.infer<typeof routeSchema>;
export type StopInput = z.infer<typeof stopSchema>;
export type SchoolTripInput = z.infer<typeof schoolTripSchema>;
