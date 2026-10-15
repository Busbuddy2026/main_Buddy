import type {
  CrewMarkView,
  CrewStopView,
  CrewStudentView,
  MarkPhaseKey,
  MarkStatusKey,
  TripPhaseKey,
} from "@/lib/api/schemas/crew";

/**
 * Attendant app vocabulary. The roster, stops and marks come from the server
 * (GET /api/crew/plan, cached on the phone); these helpers only shape them.
 */

export type TripPhase = TripPhaseKey;
export type MarkPhase = MarkPhaseKey;
export type MarkStatus = MarkStatusKey;
export type CrewStop = CrewStopView;
export type CrewStudent = CrewStudentView;
export type Mark = CrewMarkView;

/** Marks are keyed by `(phase, studentId)` — the same key the server uses. */
export const markKey = (phase: MarkPhase, studentId: string) => `${phase}:${studentId}`;

/** Students to mark at a stop — everyone when boarding at school, else that stop's group. */
export function studentsAt(stop: CrewStop | undefined, students: CrewStudent[]): CrewStudent[] {
  if (!stop) return [];
  return stop.boarding ? [...students] : students.filter((s) => s.stop === stop.key);
}

/** Record tones for the profile list. */
export const RECORD_TONE = {
  good: { bg: "#e6f4ea", fg: "#186c33" },
  delayed: { bg: "#fef7e0", fg: "#8f5b00" },
  bad: { bg: "#fce8e6", fg: "#c5221f" },
} as const;
