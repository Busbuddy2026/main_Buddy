/**
 * Response shapes shared by the server (services, mappers) and the browser
 * (stores). Anything the API returns is typed here, so a change on one side
 * fails the build on the other.
 */

export type AdminRole = "SUPER_ADMIN" | "TRANSPORT_MANAGER" | "OFFICE_STAFF" | "VIEWER";

export interface AdminMe {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  email: string;
  role: AdminRole;
  roleTitle: string;
  school: { name: string; phone: string | null };
}

export interface ParentChild {
  id: string;
  first: string;
  name: string;
  initial: string;
  cls: string;
  roll: string;
  bus: string;
  stop: string;
}

export interface ParentPrefs {
  alerts: boolean;
  absence: boolean;
  digest: boolean;
}

export interface ParentMe {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  /** Ten digits, no country code. */
  phone: string;
  prefs: ParentPrefs;
  children: ParentChild[];
}

export interface CrewMe {
  id: string;
  name: string;
  initials: string;
  role: string;
  crewId: string;
  phone: string;
  bus: { id: string; label: string; reg: string; route: string | null } | null;
  /** The driver, for an attendant; the attendant, for a driver. */
  partner: { name: string; initials: string; phone: string } | null;
}

/** A bus on the live screens. Positions come from the tracking vendor. */
export interface BusLive {
  /** Database id. */
  busId: string;
  number: string;
  reg: string;
  routeId: string | null;
  route: string | null;
  driver: string | null;
  attendant: string | null;
  capacity: number;
  riders: number;
  /** A tracker is linked to this bus. */
  linked: boolean;
  vehicleNo: string | null;
  /** Dashcam channels available for live view. */
  channels: number;
  camerasOnline: number;
  camerasTotal: number;
  /** unlinked: no tracker. offline: no fix for 10+ minutes. */
  state: "unlinked" | "offline" | "moving" | "idle" | "stopped";
  fix: {
    lat: number;
    lng: number;
    speed: number;
    heading: number | null;
    ignition: boolean | null;
    /** ISO time of the fix. */
    at: string;
    ageMin: number;
    address: string | null;
  } | null;
  trip: {
    id: string;
    phase: "morning" | "evening";
    onboard: number;
    delayMin: number;
    nextStop: { name: string; etaMin: number; distanceKm: number } | null;
  } | null;
  alarms: string[];
}

export interface LiveRoute {
  id: string;
  name: string;
  points: Array<{ lat: number; lng: number; name: string }>;
}

export interface LiveFleet {
  syncedAt: string;
  buses: BusLive[];
  routes: LiveRoute[];
}

/** One bus's position for the crew and parent apps. */
export interface OneBusLive {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number;
  ageMin: number;
  /** No fix for 10+ minutes. */
  offline: boolean;
  /** Next stop on the running trip, if any. */
  nextStop: { name: string; etaMin: number; distanceKm: number } | null;
  /** Distance and ETA to one stop (the parent's), if asked for. */
  toStop: { name: string; etaMin: number; distanceKm: number } | null;
  route: Array<{ lat: number; lng: number; name: string }>;
}
