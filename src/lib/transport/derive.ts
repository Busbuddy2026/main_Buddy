import { BUS_TELEMETRY } from "./seed";
import { STATUS_KIND, pill, type PillSpec } from "./tone";
import type { Bus, Driver, Student, TransportData } from "./types";

/** Case-insensitive "does any of these fields contain the needle". */
export function hit(needle: string, ...fields: Array<string | number | undefined>): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return true;
  return fields.some((f) => String(f ?? "").toLowerCase().includes(n));
}

export interface BusRow extends Bus {
  ratio: string;
  gps: PillSpec;
  cam: PillSpec;
  statusPill: PillSpec;
  /** Buses without telemetry fall back to Bus 12's live trip. */
  trackedId: string;
}

export function busRows(data: TransportData): BusRow[] {
  return data.buses.map((b) => ({
    ...b,
    ratio: `${b.onboard ?? 0} / ${b.cap}`,
    gps: b.kind === "offline" ? pill("Offline", "bad") : pill("Strong", "good"),
    // Bus 08's door camera is down (README §7 seed state).
    cam: b.id === "08" ? pill("2 / 3", "delayed") : pill("3 / 3", "good"),
    statusPill: pill(b.status, b.kind),
    trackedId: BUS_TELEMETRY[b.id] ? b.id : "12",
  }));
}

export interface StudentRow extends Student {
  amPill: PillSpec;
  pmPill: PillSpec;
  initial: string;
}

export function studentRows(data: TransportData): StudentRow[] {
  return data.students.map((s) => ({
    ...s,
    amPill: pill(s.am || "Pending", STATUS_KIND[s.am] ?? "offline"),
    pmPill: pill(s.pm || "Pending", STATUS_KIND[s.pm] ?? "offline"),
    initial: (s.name || "?").charAt(0),
    updated: s.updated || "—",
  }));
}

export interface DriverRow extends Driver {
  licPill: PillSpec;
  statusPill: PillSpec;
  initials: string;
  barColor: string;
  docGlyph: string;
  docFg: string;
  docLabel: string;
  /** Violation counts for the driver-performance drill-down. */
  speedEvents: number;
  braking: number;
  trips: number;
}

const SPEED_EVENTS = [2, 9, 4, 11, 3];
const BRAKING = [1, 4, 2, 6, 1];
const TRIP_COUNTS = [58, 54, 57, 41, 60];

export function driverRows(data: TransportData): DriverRow[] {
  return data.drivers.map((d, i) => {
    const score = d.score || 0;
    return {
      ...d,
      score,
      today: d.today || "Not scheduled",
      licPill: pill(d.licLabel || `Valid · ${d.expiry || "—"}`, d.licKind || "good"),
      statusPill: pill(d.status || "Idle", d.kind || "offline"),
      initials: (d.name || "?")
        .split(" ")
        .map((w) => w.charAt(0))
        .join(""),
      barColor: score >= 90 ? "#1e8e3e" : score >= 80 ? "#1a73e8" : "#f29900",
      docGlyph: d.licenceDoc ? "task" : "note_add",
      docFg: d.licenceDoc ? "#186c33" : "#a8aeb7",
      docLabel: d.licenceDoc ? "Licence copy attached" : "No licence copy uploaded",
      speedEvents: SPEED_EVENTS[i] ?? 0,
      braking: BRAKING[i] ?? 0,
      trips: TRIP_COUNTS[i] ?? 0,
    };
  });
}

export function attendantRows(data: TransportData) {
  return data.attendants.map((a) => {
    const done = a.done || 0;
    const total = a.total || 0;
    return {
      ...a,
      statusPill: pill(a.status || "Idle", a.kind || "offline"),
      ratio: `${done} / ${total}`,
      pct: `${total ? Math.round((done / total) * 100) : 0}%`,
    };
  });
}

export function schoolTripRows(data: TransportData) {
  return data.trips.map((t) => {
    const fleet = t.fleet ?? [];
    const total = fleet.reduce((n, f) => n + (parseInt(f.students, 10) || 0), 0);
    return {
      ...t,
      fleet,
      busSummary: fleet.length ? fleet.map((f) => f.bus).join(", ") : "No bus assigned",
      busCount: `${fleet.length} ${fleet.length === 1 ? "bus" : "buses"}`,
      studentTotal: String(total),
      statusPill: pill(t.status || "Scheduled", t.kind || "offline"),
      live: t.status === "On the way",
    };
  });
}
