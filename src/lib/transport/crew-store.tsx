"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiRequestError, api, newId } from "@/lib/api/client";
import { forgetAnswers } from "@/lib/api/use-api";
import type { CrewMe } from "@/lib/api/types";
import { SCHOOL_STOP_KEY, type CrewOp, type CrewPlan, type OpResult, type PhasePlan } from "@/lib/api/schemas/crew";
import { formatTime } from "@/lib/time";
import { usePersistentState } from "./persist";
import {
  markKey,
  studentsAt,
  type CrewStop,
  type CrewStudent,
  type Mark,
  type MarkPhase,
  type MarkStatus,
  type TripPhase,
} from "./crew";

/*
 * Attendant trip state — offline first (non-negotiable 4).
 *
 * The server plan (bus, stops, riders, marks) is cached on the phone. Every
 * action the attendant takes becomes an event in a persisted queue and shows
 * at once; the queue replays in order to POST /api/crew/sync whenever the
 * phone is online (immediately, on reconnect, on focus, and every 20 s). What
 * the screens show is the cached plan with the unsent events applied on top.
 *
 * Storage is keyed by crew member, so a shared phone never replays one
 * attendant's events under another's session. Sign-in is crew ID + PIN
 * against the API, which issues the httpOnly `gf_crew` cookie.
 */

interface Stored {
  trip: TripPhase;
  stopIndex: number;
  plan: CrewPlan | null;
  queue: CrewOp[];
}

const EMPTY_PHASE: PhasePlan = { status: "NOT_STARTED", stops: [], marks: {}, students: [], sos: false };
const PLACEHOLDER_STOP: CrewStop = { key: "", name: "No stops", short: "—", time: "" };

const DEVICE_KEY = "bvm.crew.device";
const SYNC_EVERY_MS = 20_000;

/** A stable random ID for this phone, sent at sign-in so the office can see device swaps. */
function deviceId(): string {
  try {
    const known = window.localStorage.getItem(DEVICE_KEY);
    if (known) return known;
    const fresh = newId();
    window.localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    return newId();
  }
}

/** The queued events for one trip, applied over the server's marks. Exported for tests. */
export function overlay(base: PhasePlan, queue: CrewOp[], date: string, trip: TripPhase, stops: CrewStop[]) {
  const marks: Record<string, Mark> = { ...base.marks };
  let status = base.status;
  let sos = base.sos;
  for (const op of queue) {
    if (op.date !== date || op.phase !== trip) continue;
    if (op.type === "start" && status === "NOT_STARTED") status = "ACTIVE";
    if (op.type === "complete") status = "COMPLETED";
    if (op.type === "sos") sos = op.active;
    if (op.type === "mark") {
      if (status === "NOT_STARTED") status = "ACTIVE";
      const stop = stops.find((s) => s.key === op.stopId);
      marks[markKey(op.markPhase, op.studentId)] = {
        status: op.status,
        stop: stop?.name ?? "Bus",
        short: stop?.short ?? "Bus",
        time: formatTime(new Date(op.at)),
        at: op.at,
        clientMarkId: op.clientMarkId,
      };
    }
    if (op.type === "undo") delete marks[markKey(op.markPhase, op.studentId)];
  }
  return { marks, status, sos };
}

interface CrewSession {
  authed: boolean;
  me: CrewMe | null;
  crewId: string;
  /** False until the cached trip has been read; hold back the screens. */
  hydrated: boolean;
  plan: CrewPlan | null;
  trip: TripPhase;
  status: PhasePlan["status"];
  stopIndex: number;
  stops: CrewStop[];
  stop: CrewStop;
  students: CrewStudent[];
  marks: Record<string, Mark>;
  sos: boolean;
  /** Evening drops are `drop`; boarding at school and all morning stops are `board`. */
  phase: MarkPhase;
  isLastStop: boolean;
  /** Events waiting to reach the server. */
  pendingSync: number;
  online: boolean;
  syncing: boolean;
  /** The last event the server refused, for the attendant to see. */
  notice: string;
  dismissNotice: () => void;
  /** Throws ApiRequestError on a wrong PIN or a locked account. */
  signIn: (crewId: string, pin: string) => Promise<void>;
  signOut: () => Promise<void>;
  setTrip: (trip: TripPhase) => void;
  startTrip: () => void;
  goToStop: (index: number) => void;
  mark: (studentId: string, status: MarkStatus) => void;
  /** False when the undo window has passed. */
  canUndo: (studentId: string) => boolean;
  undo: (studentId: string) => void;
  setSos: (on: boolean) => void;
  completeTrip: () => void;
  resetTrip: () => void;
  syncNow: () => Promise<void>;
  boardedTotal: number;
  droppedTotal: number;
  absentTotal: number;
  pendingTotal: number;
}

const Ctx = createContext<CrewSession | null>(null);

export function CrewSessionProvider({
  me,
  initialPlan,
  children,
}: {
  me: CrewMe | null;
  /** Fresh from the server on first render; null when offline or signed out. */
  initialPlan: CrewPlan | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const { state, setState, hydrated } = usePersistentState<Stored>(
    `bvm.crew.v2.${me?.id ?? "signed-out"}`,
    { trip: "morning", stopIndex: 0, plan: initialPlan, queue: [] },
  );
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");

  // The server's plan is fresher than the cached one; the queue survives.
  useEffect(() => {
    if (hydrated && initialPlan) setState((s) => ({ ...s, plan: initialPlan }));
  }, [hydrated, initialPlan, setState]);

  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);
  const flushing = useRef(false);
  // A mark tapped while a sync is in flight must not wait for the timer.
  const again = useRef(false);
  const syncRef = useRef<() => Promise<void>>(async () => undefined);

  const syncNow = useCallback(async () => {
    if (!me) return;
    if (flushing.current) {
      again.current = true;
      return;
    }
    flushing.current = true;
    again.current = false;
    setSyncing(true);
    const sent = latest.current.queue;
    try {
      if (!sent.length) {
        const plan = await api.get<CrewPlan>("/api/crew/plan");
        setState((s) => ({ ...s, plan }));
      } else {
        const res = await api.post<{ results: OpResult[]; plan: CrewPlan }>("/api/crew/sync", { ops: sent });
        const settled = new Set(res.results.map((r) => r.opId));
        const refused = res.results.filter((r) => !r.ok && r.error);
        if (refused.length) setNotice(refused[refused.length - 1]!.error!);
        // Events queued while this request was in flight stay queued.
        setState((s) => ({ ...s, plan: res.plan, queue: s.queue.filter((op) => !settled.has(op.opId)) }));
      }
      setOnline(true);
    } catch (error) {
      if (error instanceof ApiRequestError && error.offline) setOnline(false);
      else if (error instanceof ApiRequestError && error.code === "UNAUTHENTICATED") router.refresh();
    } finally {
      flushing.current = false;
      setSyncing(false);
      if (again.current) window.setTimeout(() => void syncRef.current(), 0);
    }
  }, [me, router, setState]);

  useEffect(() => {
    syncRef.current = syncNow;
  }, [syncNow]);

  // Sync on load, on reconnect, on focus and on a timer.
  useEffect(() => {
    if (!me || !hydrated) return;
    void syncNow();
    const kick = () => void syncNow();
    const goOffline = () => setOnline(false);
    window.addEventListener("online", kick);
    window.addEventListener("offline", goOffline);
    window.addEventListener("focus", kick);
    const timer = window.setInterval(kick, SYNC_EVERY_MS);
    return () => {
      window.removeEventListener("online", kick);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("focus", kick);
      window.clearInterval(timer);
    };
  }, [me, hydrated, syncNow]);

  const enqueue = useCallback(
    (make: (date: string, trip: TripPhase) => CrewOp[]) => {
      const { plan, trip } = latest.current;
      if (!plan) return;
      const ops = make(plan.date, trip);
      if (!ops.length) return;
      setState((s) => ({ ...s, queue: [...s.queue, ...ops] }));
      // Give React a tick to persist, then try to send.
      window.setTimeout(() => void syncNow(), 0);
    },
    [setState, syncNow],
  );

  const value = useMemo<CrewSession>(() => {
    const plan = state.plan;
    const base = plan?.phases[state.trip] ?? EMPTY_PHASE;
    const stops = base.stops;
    const stopIndex = Math.min(state.stopIndex, Math.max(stops.length - 1, 0));
    const stop = stops[stopIndex] ?? PLACEHOLDER_STOP;
    const { marks, status, sos } = overlay(base, state.queue, plan?.date ?? "", state.trip, stops);
    const students = base.students;
    const evening = state.trip === "evening";
    const phase: MarkPhase = evening && !stop.boarding ? "drop" : "board";
    const riding = students.filter((s) => !s.absence);

    const boardedTotal = students.filter((s) => {
      const m = marks[markKey("board", s.id)];
      return m && m.status !== "absent";
    }).length;
    const droppedTotal = students.filter((s) => {
      const m = marks[markKey("drop", s.id)];
      return m && m.status !== "absent";
    }).length;
    const absentTotal =
      students.filter((s) => marks[markKey("board", s.id)]?.status === "absent").length +
      students.filter((s) => s.absence && !marks[markKey("board", s.id)]).length;

    const opBase = (date: string, trip: TripPhase) => ({
      opId: newId(),
      date,
      phase: trip,
      at: new Date().toISOString(),
    });
    const startIfNeeded = (date: string, trip: TripPhase): CrewOp[] =>
      status === "NOT_STARTED" ? [{ ...opBase(date, trip), type: "start" }] : [];

    return {
      authed: me !== null,
      me,
      crewId: me?.crewId ?? "",
      hydrated,
      plan,
      trip: state.trip,
      status,
      stopIndex,
      stops,
      stop,
      students,
      marks,
      sos,
      phase,
      isLastStop: stopIndex >= stops.length - 1,
      pendingSync: state.queue.length,
      online,
      syncing,
      notice,
      dismissNotice: () => setNotice(""),
      boardedTotal,
      droppedTotal,
      absentTotal,
      pendingTotal: evening
        ? boardedTotal - droppedTotal
        : Math.max(0, riding.length - students.filter((s) => !s.absence && marks[markKey("board", s.id)]).length),
      signIn: async (crewId: string, pin: string) => {
        await api.post("/api/auth/crew/login", { crewId, pin, deviceId: deviceId() });
        router.refresh();
      },
      // Unsent events stay stored under this crew member and replay at the next sign-in.
      signOut: async () => {
        await api.post("/api/auth/crew/logout").catch(() => undefined);
        forgetAnswers();
        router.refresh();
      },
      setTrip: (t: TripPhase) => setState((s) => ({ ...s, trip: t, stopIndex: 0 })),
      startTrip: () => enqueue((date, trip) => startIfNeeded(date, trip)),
      goToStop: (index: number) => setState((s) => ({ ...s, stopIndex: index })),
      mark: (studentId, markStatus) =>
        enqueue((date, trip) => [
          ...startIfNeeded(date, trip),
          {
            ...opBase(date, trip),
            type: "mark",
            clientMarkId: newId(),
            studentId,
            markPhase: phase,
            status: markStatus,
            stopId: stop.key && stop.key !== SCHOOL_STOP_KEY ? stop.key : null,
          },
        ]),
      canUndo: (studentId) => {
        const m = marks[markKey(phase, studentId)];
        if (!m) return false;
        return Date.now() - new Date(m.at).getTime() <= (plan?.undoWindowMin ?? 10) * 60_000;
      },
      undo: (studentId) =>
        enqueue((date, trip) => [{ ...opBase(date, trip), type: "undo", studentId, markPhase: phase }]),
      setSos: (on: boolean) => enqueue((date, trip) => [{ ...opBase(date, trip), type: "sos", active: on }]),
      completeTrip: () => enqueue((date, trip) => [{ ...opBase(date, trip), type: "complete" }]),
      resetTrip: () => setState((s) => ({ ...s, stopIndex: 0 })),
      syncNow,
    };
  }, [state, me, hydrated, online, syncing, notice, router, setState, enqueue, syncNow]);

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

  return studentsAt(stop, session.students)
    .filter((s) => {
      // A drop stop lists only the students who got on.
      if (phase !== "drop") return true;
      const b = session.marks[markKey("board", s.id)];
      return !!b;
    })
    .map((s) => {
      const m = session.marks[markKey(phase, s.id)];
      const boarded = session.marks[markKey("board", s.id)];
      const didBoard = !!boarded && boarded.status !== "absent";
      // A drop cannot be recorded for a student who never boarded.
      const blocked = phase === "drop" && !didBoard;
      // A parent's absence notice settles the student without a tap.
      const reported = !m && phase === "board" && !!s.absence;
      const absent = m?.status === "absent" || reported;

      return {
        ...s,
        initial: s.name.charAt(0),
        mark: m,
        settled: !!m || reported,
        pending: !m && !blocked && !reported,
        blocked,
        blockedText: boarded?.status === "absent" ? "Marked absent at school" : "Not boarded yet",
        statusText: absent ? "Absent" : verb,
        glyph: absent ? "remove" : "check",
        tone: absent ? { bg: "#f1f3f4", fg: "#5f6672" } : { bg: "#e6f4ea", fg: "#186c33" },
        record: reported
          ? `Parent reported absence${s.absence?.reason ? ` · ${s.absence.reason}` : ""}`
          : m
            ? absent
              ? `Marked absent at ${m.short} · ${m.time}`
              : `${verb} at ${m.short} · ${m.time}`
            : "",
        reported,
        primaryLabel: phase === "drop" ? "Mark dropped" : "Boarded",
      };
    });
}
