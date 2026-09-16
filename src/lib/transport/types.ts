import type { ToneKind } from "./tone";

export interface Bus {
  id: string;
  reg: string;
  cap: string;
  driver: string;
  attendant: string;
  route: string;
  onboard: number;
  kind: ToneKind;
  status: string;
}

export interface Route {
  id: string;
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
  name: string;
  route: string;
  time: string;
  drop: string;
  students: string;
  landmark: string;
}

export interface Student {
  id: string;
  name: string;
  cls: string;
  bus: string;
  route: string;
  stop: string;
  parent: string;
  phone: string;
  am: string;
  pm: string;
  updated: string;
}

export interface Driver {
  id: string;
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
  bus: string;
  driver: string;
  attendant: string;
  students: string;
}

export interface SchoolTrip {
  id: string;
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
  file: string;
  size: string;
  on: string;
  exp: string;
}

export type BusDocuments = Record<string, Record<string, BusDocument>>;

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
