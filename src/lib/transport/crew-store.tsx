"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CREW_STUDENTS,
  markKey,
  stopsFor,
  studentsAt,
  type CrewStop,
  type Mark,
  type MarkPhase,
  type MarkStatus,
  type TripPhase,
} from "./crew";

/*
 * Attendant trip state.
 *
 * This is a demo gate, not authentication. Real sign-in is crew ID + PIN bound
 * to a device, issuing an httpOnly `gf_crew` cookie (README §4).
 *
 * Marks are held by `(phase, studentId)` — the same key the server uses to make
 * replayed marks idempotent. The offline queue (README §C6) belongs here too:
 * cache the roster on trip start, queue marks with their local timestamp and
 * flush in order on reconnect.
 */

interface CrewState {
  authed: boolean;
  crewId: string;
  trip: TripPhase;
  stopIndex: number;
  marks: Record<string, Mark>;
  sos: boolean;
}

interface CrewSession extends CrewState {
  stops: CrewStop[];
  stop: CrewStop;
  /** Evening drops are `drop`; boarding at school and all morning stops are `board`. */
  phase: MarkPhase;
  isLastStop: boolean;
  signIn: (crewId: string) => void;
  signOut: () => void;
  setTrip: (trip: TripPhase) => void;
  goToStop: (index: number) => void;
  mark: (studentId: string, status: MarkStatus) => void;
  undo: (studentId: string) => void;
  setSos: (on: boolean) => void;
  resetTrip: () => void;
  /** Students who boarded and have not yet been dropped. */
  boardedTotal: number;
  droppedTotal: number;
  absentTotal: number;
  pendingTotal: number;
}

const Ctx = createContext<CrewSession | null>(null);

export function CrewSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CrewState>({
    authed: false,
    crewId: "",
    trip: "morning",
    stopIndex: 0,
    marks: {},
    sos: false,
  });

  const stops = stopsFor(state.trip);
  const stopIndex = Math.min(state.stopIndex, stops.length - 1);
  const stop = stops[stopIndex];
  const phase: MarkPhase = state.trip === "evening" && !stop.boarding ? "drop" : "board";

  const mark = useCallback(
    (studentId: string, status: MarkStatus) =>
      setState((s) => {
        const current = stopsFor(s.trip);
        const at = current[Math.min(s.stopIndex, current.length - 1)];
        const ph: MarkPhase = s.trip === "evening" && !at.boarding ? "drop" : "board";
        return {
          ...s,
          marks: {
            ...s.marks,
            [markKey(ph, studentId)]: {
              status,
              stop: at.name,
              short: at.short,
              time: at.time,
            },
          },
        };
      }),
    [],
  );

  const undo = useCallback(
    (studentId: string) =>
      setState((s) => {
        const current = stopsFor(s.trip);
        const at = current[Math.min(s.stopIndex, current.length - 1)];
        const ph: MarkPhase = s.trip === "evening" && !at.boarding ? "drop" : "board";
        const next = { ...s.marks };
        delete next[markKey(ph, studentId)];
        return { ...s, marks: next };
      }),
    [],
  );

  const value = useMemo<CrewSession>(() => {
    const { marks, trip } = state;
    const evening = trip === "evening";

    const boardedTotal = CREW_STUDENTS.filter((s) => {
      const m = marks[markKey("board", s.id)];
      return m && m.status !== "absent";
    }).length;
    const droppedTotal = CREW_STUDENTS.filter((s) => {
      const m = marks[markKey("drop", s.id)];
      return m && m.status !== "absent";
    }).length;
    const absentTotal = CREW_STUDENTS.filter(
      (s) => marks[markKey("board", s.id)]?.status === "absent",
    ).length;

    return {
      ...state,
      stopIndex,
      stops,
      stop,
      phase,
      isLastStop: stopIndex >= stops.length - 1,
      boardedTotal,
      droppedTotal,
      absentTotal,
      pendingTotal: evening
        ? boardedTotal - droppedTotal
        : CREW_STUDENTS.length - boardedTotal - absentTotal,
      signIn: (crewId: string) => setState((s) => ({ ...s, authed: true, crewId })),
      signOut: () =>
        setState({ authed: false, crewId: "", trip: "morning", stopIndex: 0, marks: {}, sos: false }),
      setTrip: (t: TripPhase) =>
        setState((s) => ({ ...s, trip: t, marks: {}, stopIndex: 0, sos: false })),
      goToStop: (index: number) => setState((s) => ({ ...s, stopIndex: index })),
      mark,
      undo,
      setSos: (on: boolean) => setState((s) => ({ ...s, sos: on })),
      resetTrip: () => setState((s) => ({ ...s, marks: {}, stopIndex: 0, sos: false })),
    };
  }, [state, stopIndex, stops, stop, phase, mark, undo]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCrew(): CrewSession {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCrew must be used inside <CrewSessionProvider>");
  return ctx;
}

/** Roster for one stop, with each student's mark state resolved. */
export function rosterFor(session: CrewSession, stop: CrewStop, phase: MarkPhase) {
  const verb = phase === "drop" ? "Dropped" : "Boarded";

  return studentsAt(stop).map((s) => {
    const m = session.marks[markKey(phase, s.id)];
    const boarded = session.marks[markKey("board", s.id)];
    const didBoard = !!boarded && boarded.status !== "absent";
    // A drop cannot be recorded for a student who never boarded.
    const blocked = phase === "drop" && !didBoard;
    const absent = m?.status === "absent";

    return {
      ...s,
      initial: s.name.charAt(0),
      mark: m,
      settled: !!m,
      pending: !m && !blocked,
      blocked,
      blockedText:
        boarded?.status === "absent" ? "Marked absent at school" : "Not boarded yet",
      statusText: absent ? "Absent" : verb,
      glyph: absent ? "remove" : "check",
      tone: absent ? { bg: "#f1f3f4", fg: "#5f6672" } : { bg: "#e6f4ea", fg: "#186c33" },
      record: m
        ? absent
          ? `Marked absent at ${m.short} · ${m.time}`
          : `${verb} at ${m.short} · ${m.time}`
        : "",
      primaryLabel: phase === "drop" ? "Mark dropped" : "Boarded",
    };
  });
}
