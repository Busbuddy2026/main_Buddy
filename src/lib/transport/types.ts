import type { ToneKind } from "./tone";

/*
 * View models. The server builds these from the database
 * (src/server/services/masters.ts) so screens render display strings
 * directly; the `*Id` fields carry the real references the forms send back.
 */

export interface Bus {
  /** The bus number ("12"): shown as "Bus 12" and used in URLs. */
  id: string;
  /** Database id. */
  uid: string;
  driverId: string | null;
  attendantId: string | null;
  routeId: string | null;
  reg: string;
  cap: string;
  driver: string;
  attendant: string;
  route: string;
  onboard: number;
  /** Cameras reporting online, of those fitted. */
  cams: { online: number; total: number };
  /** A GPS tracker is linked to this bus. */
  gpsLinked: boolean;
  kind: ToneKind;
  status: string;
}

export interface Route {
  id: string;
  /** Display code ("R1"). */
  code: string;
  busId: string | null;
  name: string;
  bus: string;
  zone: string;
  stopCount: string;
  students: string;
  km: string;
  dur: string;
  kind: ToneKind;
  status: string;
}

export interface Stop {
  id: string;
  /** The first route the stop is on (the one `route`, `time` and `drop` describe). */
  routeId: string | null;
  /** Every route the stop is on, and its place and times on each. */
  routeIds: string[];
  onRoutes: Record<string, { seq: number; time: string; drop: string }>;
  name: string;
  route: string;
  time: string;
  drop: string;
  students: string;
  landmark: string;
  /** "9.18129, 77.39932" when the stop has a map pin, else "". */
  location: string;
}

export interface Student {
  id: string;
  busId: string | null;
  routeId: string | null;
  stopId: string | null;
  name: string;
  cls: string;
  bus: string;
  route: string;
  stop: string;
  /** Empty when the student has no parent account yet. */
  parent: string;
  phone: string;
  /** An unverified contact number from the school's register; never a login. */
  contact: string;
  am: string;
  pm: string;
  updated: string;
}

export interface Driver {
  id: string;
  crewId: string;
  busId: string | null;
  name: string;
  bus: string;
  phone: string;
  licence: string;
  expiry: string;
  licenceDoc?: string;
  today: string;
  score: number;
  kind: ToneKind;
  status: string;
  licKind: ToneKind;
  licLabel: string;
}

export interface Attendant {
  id: string;
  crewId: string;
  busId: string | null;
  routeId: string | null;
  name: string;
  bus: string;
  route: string;
  phone: string;
  done: number;
  total: number;
  kind: ToneKind;
  status: string;
}

export interface FleetRow {
  id: string;
  busId: string;
  driverId: string;
  attendantId: string;
  bus: string;
  driver: string;
  attendant: string;
  students: string;
}

export interface SchoolTrip {
  id: string;
  /** Display code ("T-1041"). */
  code: string;
  name: string;
  destination: string;
  date: string;
  depart: string;
  ret: string;
  teacher: string;
  consent: string;
  notes: string;
  kind: ToneKind;
  status: string;
  fleet: FleetRow[];
}

/** Live telemetry, keyed by bus number. Replaced by the socket feed in §5. */
export interface BusTelemetry {
  id: string;
  reg: string;
  route: string;
  routeId: string;
  status: string;
  kind: ToneKind;
  driver: string;
  attendant: string;
  students: number;
  cap: number;
  speed: number;
  stop: string;
  next: string;
  eta: string;
  progress: number;
  gps: string;
  cam: string;
}

export interface BusDocument {
  /** Database id, for download and delete. */
  id: string;
  file: string;
  size: string;
  on: string;
  exp: string;
}

/** Bus number → document kind ("rc", "fitness", …) → the latest upload. */
export type BusDocuments = Record<string, Record<string, BusDocument>>;

/** A select option: the value sent to the API, the label shown. */
export interface Option {
  value: string;
  label: string;
}

/** The mutable store. Mirrors the collections in docs/handoff/prisma/schema.prisma. */
export interface TransportData {
  buses: Bus[];
  routes: Route[];
  stops: Stop[];
  students: Student[];
  drivers: Driver[];
  attendants: Attendant[];
  trips: SchoolTrip[];
}

export type EntityName =
  | "Student"
  | "Driver"
  | "Attendant"
  | "Bus"
  | "Route"
  | "Stop"
  | "Trip";

export type CollectionName = keyof TransportData;

export const COLLECTION: Record<EntityName, CollectionName> = {
  Student: "students",
  Driver: "drivers",
  Attendant: "attendants",
  Bus: "buses",
  Route: "routes",
  Stop: "stops",
  Trip: "trips",
};

/** Any record that can live in a collection. */
export type AnyRecord = TransportData[CollectionName][number];
