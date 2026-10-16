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

}

export function busRows(data: TransportData): BusRow[] {
  return data.buses.map((b) => ({
    ...b,
    ratio: `${b.onboard ?? 0} / ${b.cap}`,
    gps: !b.gpsLinked ? pill("Not linked", "offline") : b.status === "GPS Offline" ? pill("Offline", "bad") : pill("Live", "good"),
    cam: pill(
      b.cams.total ? `${b.cams.online} / ${b.cams.total}` : "None",
      !b.cams.total ? "offline" : b.cams.online === b.cams.total ? "good" : b.cams.online === 0 ? "bad" : "delayed",
    ),
    statusPill: pill(b.status, b.kind),

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
}

export function driverRows(data: TransportData): DriverRow[] {
  return data.drivers.map((d) => {
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
