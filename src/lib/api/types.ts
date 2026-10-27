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
  username: string;
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
  /** Primary contact for at least one child. */
  primary: boolean;
  /** BCP 47 code, e.g. "en". */
  language: string;
  school: { name: string; phone: string | null };
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
  school: { name: string };
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
    /** Late by more than the school's delay threshold (Settings → Trips). */
    delayed: boolean;
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

/** The road a bus has driven today, from its tracker's history. */
/** A stop inside a trip, as the tracking vendor reported it. */
export interface TripStop {
  start: string;
  /** Null while the bus is still stopped there. */
  end: string | null;
  durationS: number;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * One run of a bus, cut from the vendor's day timeline: driving, broken only
 * by stops shorter than half an hour. Labelled A, B, C… in order through the day.
 */
export interface BusTrip {
  key: string;
  label: string;
  running: boolean;
  start: string;
  /** Null while the trip is running. */
  end: string | null;
  durationS: number;
  distanceKm: number;
  from: string | null;
  to: string | null;
  stops: TripStop[];
  points: Array<{ lat: number; lng: number }>;
}

export interface BusTrips {
  date: string;
  trips: BusTrip[];
}

/** What the live maps draw for a bus: its running trip, or the last one (faded). */
export interface BusTrail {
  busId: string;
  number: string;
  label: string;
  running: boolean;
  points: Array<{ lat: number; lng: number }>;
  stops: TripStop[];
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
  /** The tracker's overspeed alert limit (km/h), once its settings have been read. */
  speedLimit: number | null;
}

// ── Tracker telematics (LivePin), for the bus page ─────────────────────────

/** One day of a tracker's activity, from the vendor's daily report. Durations in seconds. */
export interface DayReport {
  distanceKm: number;
  /** Seconds. */
  moving: number;
  engineOn: number;
  idle: number;
  stopped: number;
  parked: number;
  maxSpeed: number;
  avgSpeed: number;
  overspeedKm: number;
  overspeedLimit: number | null;
  fuelUsed: number;
  fuelFilled: number;
  stops: Array<{ start: string | null; end: string | null; address: string | null; at: { lat: number; lng: number } | null; geofence: string | null }>;
  timeline: Array<{ type: "MOVE" | "STOP" | string; start: string | null; end: string | null; durationS: number; address: string | null }>;
  ignition: Array<{ state: string; start: string | null; end: string | null; address: string | null }>;
  overspeed: Array<{ start: string | null; end: string | null; maxSpeed: number | null; address: string | null }>;
  geofence: Array<{ event: string; at: string | null; fence: string | null }>;
}


export interface TrackerSettings {
  overspeed: boolean;
  overspeed_limit: number;
  engine_on: boolean;
  geofence_events: boolean;
  safe_parking: boolean;
  renewal: boolean;
  interval: string | null;
}

export interface TelematicsLive {
  vehicleNo: string;
  /** LivePin's id for the vehicle. */
  vehicleId: string;
  vehicleType: string | null;
  imei: string;
  model: string | null;
  subscriptionExpiry: string | null;
  dashcamChannels: number;
  fix: {
    lat: number | null;
    lng: number | null;
    altitude: number | null;
    speed: number;
    heading: number | null;
    ignition: boolean | null;
    at: string | null;
    /** When LivePin received the fix. */
    receivedAt: string | null;
    /** Seconds between the device's fix and the vendor receiving it. */
    delayS: number | null;
    status: string | null;
    statusSince: string | null;
    address: string | null;
  };
  alarms: string[];
  /** Every alarm flag the device reported, on or off. */
  alarmFlags: Record<string, boolean>;
  sensors: {
    gpsLock: boolean | null;
    running: boolean | null;
    load: string | null;
    fuelLineConnected: boolean | null;
    circuitConnected: boolean | null;
    doorLocked: boolean | null;
    /** true = open. */
    doors: Record<"front" | "middle" | "back" | "driver" | "other", boolean | null>;
    constellations: string[];
  };
  health: {
    batteryPercent: number | null;
    externalVoltage: number | null;
    batteryVoltage: number | null;
    satellites: number | null;
    gsmSignal: number | null;
    gsmOperator: string | null;
    gnssStatus: string | null;
    /** Time of the latest history record the readings came from. */
    at: string | null;
  };
  /** Null when the tracker's settings could not be read from LivePin. */
  settings: TrackerSettings | null;
}

export interface TelematicsDay {
  date: string;
  report: DayReport | null;
  track: Array<{ lat: number; lng: number; speed: number; at: string }>;
}

export interface TrackerAlertRow {
  id: string;
  type: string;
  label: string;
  title: string;
  description: string | null;
  priority: string | null;
  at: string;
  lat: number | null;
  lng: number | null;
  incident: { id: string; code: string | null } | null;
}

export interface FleetTelematicsRow {
  bus: string;
  vehicleNo: string;
  report: DayReport | null;
  error: string | null;
}

/** A student's marks today and their morning boarding over the last 30 days. */
export interface StudentJourney {
  roll: string | null;
  /** YYYY-MM-DD, school time. */
  today: string;
  events: Array<{ id: string; time: string; title: string; by: string; absent: boolean }>;
  last30: { boarded: number; absent: number; unmarked: number };
}
