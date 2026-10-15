import type { BusTelemetry } from "./types";

/*
 * Simulated live telemetry. GPS tracking is deferred (see the build plan), so
 * the live map, the overview's trip strip and the parent track screen still
 * read these fixed positions. Everything else in the console comes from the
 * database. When the GPS ingest lands, this file is replaced by the
 * realtime feed.
 */

/** Live telemetry for the four buses currently running a trip. */
export const BUS_TELEMETRY: Record<string, BusTelemetry> = {
  "12": { id: "12", reg: "TS 09 UB 1234", route: "Kondapur → School", routeId: "R1", status: "On Time", kind: "ontime", driver: "Ramesh Kumar", attendant: "Suresh Kumar", students: 38, cap: 42, speed: 32, stop: "Botanical Garden", next: "Green Valley Apartments", eta: "7 min", progress: 62, gps: "Strong", cam: "3 / 3 live" },
  "08": { id: "08", reg: "TS 09 UB 0871", route: "Gachibowli → School", routeId: "R2", status: "Delayed 12 min", kind: "delayed", driver: "Mahesh Yadav", attendant: "Kavitha Rani", students: 31, cap: 40, speed: 12, stop: "Lanco Hills", next: "Nanakramguda Junction", eta: "19 min", progress: 34, gps: "Strong", cam: "2 / 3 live" },
  "21": { id: "21", reg: "TS 09 UB 2109", route: "Madhapur → School", routeId: "R3", status: "On Time", kind: "ontime", driver: "Imran Baig", attendant: "Suresh Naik", students: 44, cap: 48, speed: 28, stop: "HITEC City MMTS", next: "Lanco Hills", eta: "11 min", progress: 74, gps: "Strong", cam: "3 / 3 live" },
  "04": { id: "04", reg: "TS 09 UB 0442", route: "Kondapur → School", routeId: "R1", status: "GPS Offline", kind: "offline", driver: "Naveen Rao", attendant: "Latha Devi", students: 0, cap: 42, speed: 0, stop: "—", next: "Kondapur Main Road", eta: "Unknown", progress: 8, gps: "Offline 6 min", cam: "3 / 3 live" },
};

/** Compliance documents required on every bus (README §7). */
export const REQUIRED_DOCS = [
  { key: "rc", label: "Registration certificate (RC)", note: "Vehicle ownership proof" },
  { key: "fitness", label: "Fitness certificate", note: "Annual roadworthiness" },
  { key: "insurance", label: "Insurance policy", note: "Comprehensive cover" },
  { key: "permit", label: "School bus permit", note: "State transport authority" },
  { key: "puc", label: "PUC certificate", note: "Emission compliance" },
  { key: "speed", label: "Speed governor certificate", note: "Sealed at 50 km/h" },
] as const;
