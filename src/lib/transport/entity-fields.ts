import type { EntityName } from "./types";

export interface EntityField {
  key: string;
  label: string;
  ph?: string;
  /** Name of the option source rendered as a <select>, prefixed with "Unassigned". */
  opts?: "buses" | "routes" | "drivers" | "attendants" | "stops";
  /** Renders a file attachment control instead of an input. */
  upload?: boolean;
  /** Renders the multi-select student picker. */
  picker?: "students";
}

/** Dialog form definitions — SCREENS.md §A28. */
export const ENTITY_FIELDS: Record<EntityName, EntityField[]> = {
  Student: [
    { key: "name", label: "Full name", ph: "Aarav Kumar" },
    { key: "cls", label: "Class and section", ph: "Grade 5 · B" },
    { key: "bus", label: "Assigned bus", ph: "Bus 12", opts: "buses" },
    { key: "route", label: "Route", ph: "Kondapur → School", opts: "routes" },
    { key: "stop", label: "Boarding stop", ph: "Green Valley Apartments", opts: "stops" },
    { key: "parent", label: "Parent name (optional)", ph: "Rajesh Kumar" },
    { key: "phone", label: "Parent mobile: their app login (optional)", ph: "+91 98490 21145" },
    { key: "contact", label: "Other contact: unverified, no login (optional)", ph: "+91 98490 21145" },
  ],
  Driver: [
    { key: "name", label: "Full name", ph: "Ramesh Kumar" },
    { key: "phone", label: "Mobile", ph: "+91 98490 33210" },
    { key: "licence", label: "Licence number", ph: "TS 0220190004512" },
    { key: "expiry", label: "Licence expiry", ph: "14 Mar 2029" },
    { key: "bus", label: "Assigned bus", ph: "Bus 12", opts: "buses" },
    { key: "licenceDoc", label: "Licence copy", upload: true },
  ],
  // An attendant's route is their bus's route.
  Attendant: [
    { key: "name", label: "Full name", ph: "Suresh Kumar" },
    { key: "phone", label: "Mobile", ph: "+91 98490 44120" },
    { key: "bus", label: "Assigned bus", ph: "Bus 12", opts: "buses" },
  ],
  Bus: [
    { key: "id", label: "Bus number", ph: "12" },
    { key: "reg", label: "Registration number", ph: "TS 09 UB 1234" },
    { key: "cap", label: "Capacity", ph: "42" },
    { key: "driver", label: "Driver", ph: "Ramesh Kumar", opts: "drivers" },
    { key: "attendant", label: "Attendant", ph: "Suresh Kumar", opts: "attendants" },
    { key: "route", label: "Route", ph: "Kondapur → School", opts: "routes" },
    { key: "mileage", label: "Mileage (km per litre, for fuel estimates)", ph: "5" },
    { key: "idleBurn", label: "Idling burn (litres an hour)", ph: "2.5" },
    { key: "serviceKm", label: "Service every (km)", ph: "10000" },
    { key: "lastService", label: "Last serviced on", ph: "2026-10-01" },
  ],
  Route: [
    { key: "name", label: "Route name", ph: "Kondapur → School" },
    { key: "bus", label: "Assigned bus", ph: "Bus 12", opts: "buses" },
    { key: "zone", label: "Zone", ph: "West Hyderabad" },
    { key: "km", label: "Distance", ph: "11.4 km" },
    { key: "dur", label: "Estimated duration", ph: "45 min" },
  ],
  Stop: [
    { key: "name", label: "Stop name", ph: "Green Valley Apartments" },
    { key: "route", label: "Route", ph: "Kondapur → School", opts: "routes" },
    { key: "time", label: "Pickup time", ph: "7:24 AM" },
    { key: "drop", label: "Drop time", ph: "4:20 PM" },
    { key: "landmark", label: "Landmark", ph: "Opposite HDFC Bank" },
    { key: "location", label: "Map location", ph: "Paste a Google Maps link, or 9.18129, 77.39932" },
    { key: "studentIds", label: "Students boarding here", picker: "students" },
  ],
  Trip: [
    { key: "name", label: "Trip name", ph: "Grade 6 science museum visit" },
    { key: "destination", label: "Destination", ph: "Birla Science Museum, Naubat Pahad" },
    { key: "date", label: "Date", ph: "18 September 2026" },
    { key: "depart", label: "Departure time", ph: "8:30 AM" },
    { key: "ret", label: "Expected return", ph: "2:30 PM" },
    { key: "teacher", label: "Teacher in charge", ph: "Meera Krishnan" },
    { key: "notes", label: "Notes", ph: "Packed lunch, return via Banjara Hills" },
  ],
};

export const ENTITY_LABEL: Record<EntityName, string> = {
  Student: "student",
  Driver: "driver",
  Attendant: "attendant",
  Bus: "bus",
  Route: "route",
  Stop: "stop",
  Trip: "school trip",
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
