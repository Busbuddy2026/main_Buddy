import { z } from "zod";
import type { OneBusLive } from "@/lib/api/types";

/**
 * The crew app's offline event log (README §C6, non-negotiable 4).
 *
 * Every action an attendant takes is an event with its own id, stamped with
 * the device time and the school date it belongs to. Events queue on the
 * phone and replay in order through POST /api/crew/sync; the server applies
 * each one once (by `opId`, and marks also by `clientMarkId`), so a replay
 * after a dropped connection cannot double-count.
 */

export type TripPhaseKey = "morning" | "evening";
export type MarkPhaseKey = "board" | "drop";
export type MarkStatusKey = "boarded" | "dropped" | "absent";

const base = {
  opId: z.string().min(8).max(64),
  /** School-local date the event belongs to ("YYYY-MM-DD"). */
  date: z.iso.date(),
  phase: z.enum(["morning", "evening"]),
  /** Device time, ISO 8601. */
  at: z.iso.datetime({ offset: true }),
};

export const crewOpSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("start") }),
  z.object({
    ...base,
    type: z.literal("mark"),
    clientMarkId: z.string().min(8).max(64),
    studentId: z.string().min(1).max(40),
    markPhase: z.enum(["board", "drop"]),
    status: z.enum(["boarded", "dropped", "absent"]),
    stopId: z.string().max(40).nullable(),
  }),
  z.object({
    ...base,
    type: z.literal("undo"),
    studentId: z.string().min(1).max(40),
    markPhase: z.enum(["board", "drop"]),
  }),
  z.object({ ...base, type: z.literal("complete") }),
  z.object({ ...base, type: z.literal("sos"), active: z.boolean() }),
]);

export const syncSchema = z.object({ ops: z.array(crewOpSchema).max(500) });

export type CrewOp = z.infer<typeof crewOpSchema>;

export interface CrewStopView {
  /** The stop id. */
  key: string;
  name: string;
  short: string;
  time: string;
  /** Evening trips start by boarding everyone at school. */
  boarding?: boolean;
}

export interface CrewStudentView {
  id: string;
  name: string;
  cls: string;
  /** Stop id this student boards at (morning) and is dropped at (evening). */
  stop: string;
  /** A parent reported this child will not travel on this trip. */
  absence: { reason: string | null } | null;
}

export interface CrewMarkView {
  status: MarkStatusKey;
  stop: string;
  short: string;
  time: string;
  /** ISO device time, for the undo window. */
  at: string;
  clientMarkId: string;
}

export interface PhasePlan {
  status: "NOT_STARTED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  stops: CrewStopView[];
  /** Keyed `${markPhase}:${studentId}`. */
  marks: Record<string, CrewMarkView>;
  /** Students absent per a parent's request for this trip. */
  students: CrewStudentView[];
  sos: boolean;
}

export interface CrewPlan {
  date: string;
  /** The bus's GPS position, when a tracker is linked. */
  live: OneBusLive | null;
  undoWindowMin: number;
  bus: { id: string; label: string; reg: string; route: string | null } | null;
  phases: Record<TripPhaseKey, PhasePlan>;
  week: Array<{ value: string; label: string }>;
  records: Array<{ icon: string; label: string; sub: string; status: string; tone: "good" | "delayed" | "bad" }>;
}

export interface OpResult {
  opId: string;
  ok: boolean;
  /** A permanent refusal: drop the event and tell the attendant. */
  error?: string;
}

/** Crew IDs are this prefix plus four digits. The server issues them; the crew sign-in types them. */
export const CREW_ID_PREFIX = { DRIVER: "GF-DRV-", ATTENDANT: "GF-ATT-" } as const;
