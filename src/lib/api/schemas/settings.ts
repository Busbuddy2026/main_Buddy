import { z } from "zod";

/**
 * School settings, stored in `School.settings` (JSON). The shape lives here so
 * the settings screen, the API and the services read the same thing, and a
 * school row written before a field existed still parses with its default.
 */

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM.");

export const settingsSchema = z.object({
  morning: z.object({ start: clock, end: clock }).default({ start: "06:30", end: "08:30" }),
  evening: z.object({ start: clock, end: clock }).default({ start: "15:30", end: "17:30" }),
  /** How long a crew member may undo a mark (README §4: 10 minutes). */
  undoWindowMin: z.number().int().min(0).max(60).default(10),
  /** Evening trips cannot complete until every onboard student is marked dropped. */
  requireDropConfirm: z.boolean().default(true),
  /** Minutes behind schedule before a trip counts as delayed. */
  delayThresholdMin: z.number().int().min(1).max(60).default(5),
  /** CCTV retention before recordings expire. */
  retentionDays: z.number().int().min(7).max(365).default(30),
  /** CCTV backup target. Off until the school connects its Drive account. */
  cctv: z
    .object({ driveConnected: z.boolean(), driveAccount: z.string().max(200) })
    .default({ driveConnected: false, driveAccount: "" }),
  /** Diesel price per litre, for fuel cost estimates. */
  dieselPriceRs: z.number().min(1).max(1000).default(95),
  /** When school starts: the morning run should reach school before it. */
  bellTime: clock.default("08:45"),
  /** Minutes a bus may stand with the engine on before admins are alerted. */
  idleAlertMin: z.number().int().min(2).max(120).default(10),
  /** Where the school is: "9.18129, 77.39932" (a Maps link is turned into this on save). Empty: worked out from where morning runs end. */
  schoolLocation: z.string().max(500).default(""),
  /** Rides longer than this many minutes are flagged on the punctuality report. */
  maxRideMin: z.number().int().min(10).max(240).default(60),
  /** Defaults applied to a new guardian's notification preferences. */
  notify: z
    .object({ alerts: z.boolean(), absence: z.boolean(), digest: z.boolean() })
    .default({ alerts: true, absence: true, digest: false }),
});

export type SchoolSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: SchoolSettings = settingsSchema.parse({});

/** Parse whatever is stored, filling defaults; never throws. */
export function readSettings(stored: unknown): SchoolSettings {
  const parsed = settingsSchema.safeParse(stored ?? {});
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

/**
 * A partial update. Built without the defaults: Zod applies `.default()` even
 * to an omitted key, which would silently reset every setting not sent.
 */
const shape = settingsSchema.shape;
export const settingsPatchSchema = z.object({
  morning: shape.morning.unwrap().optional(),
  evening: shape.evening.unwrap().optional(),
  undoWindowMin: shape.undoWindowMin.unwrap().optional(),
  requireDropConfirm: shape.requireDropConfirm.unwrap().optional(),
  delayThresholdMin: shape.delayThresholdMin.unwrap().optional(),
  retentionDays: shape.retentionDays.unwrap().optional(),
  dieselPriceRs: shape.dieselPriceRs.unwrap().optional(),
  bellTime: shape.bellTime.unwrap().optional(),
  idleAlertMin: shape.idleAlertMin.unwrap().optional(),
  maxRideMin: shape.maxRideMin.unwrap().optional(),
  schoolLocation: shape.schoolLocation.unwrap().optional(),
  cctv: shape.cctv.unwrap().optional(),
  notify: shape.notify.unwrap().optional(),
});
