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
    { key: "parent", label: "Parent name", ph: "Rajesh Kumar" },
    { key: "phone", label: "Parent mobile", ph: "+91 98490 21145" },
  ],
  Driver: [
    { key: "name", label: "Full name", ph: "Ramesh Kumar" },
    { key: "phone", label: "Mobile", ph: "+91 98490 33210" },
    { key: "licence", label: "Licence number", ph: "TS 0220190004512" },
    { key: "expiry", label: "Licence expiry", ph: "14 Mar 2029" },
    { key: "bus", label: "Assigned bus", ph: "Bus 12", opts: "buses" },
    { key: "licenceDoc", label: "Licence copy", upload: true },
  ],
  Attendant: [
    { key: "name", label: "Full name", ph: "Suresh Kumar" },
    { key: "phone", label: "Mobile", ph: "+91 98490 44120" },
    { key: "bus", label: "Assigned bus", ph: "Bus 12", opts: "buses" },
    { key: "route", label: "Assigned route", ph: "Kondapur → School", opts: "routes" },
  ],
  Bus: [
    { key: "id", label: "Bus number", ph: "12" },
    { key: "reg", label: "Registration number", ph: "TS 09 UB 1234" },
    { key: "cap", label: "Capacity", ph: "42" },
    { key: "driver", label: "Driver", ph: "Ramesh Kumar", opts: "drivers" },
    { key: "attendant", label: "Attendant", ph: "Suresh Kumar", opts: "attendants" },
    { key: "route", label: "Route", ph: "Kondapur → School", opts: "routes" },
  ],
  Route: [
    { key: "name", label: "Route name", ph: "Kondapur → School" },
    { key: "bus", label: "Assigned bus", ph: "Bus 12", opts: "buses" },
    { key: "zone", label: "Zone", ph: "West Hyderabad" },
    { key: "students", label: "Students assigned", ph: "42" },
    { key: "km", label: "Distance", ph: "11.4 km" },
    { key: "dur", label: "Estimated duration", ph: "45 min" },
  ],
  Stop: [
    { key: "name", label: "Stop name", ph: "Green Valley Apartments" },
    { key: "route", label: "Route", ph: "Kondapur → School", opts: "routes" },
    { key: "time", label: "Pickup time", ph: "7:24 AM" },
    { key: "drop", label: "Drop time", ph: "4:20 PM" },
    { key: "landmark", label: "Landmark", ph: "Opposite HDFC Bank" },
    { key: "studentIds", label: "Students boarding here", picker: "students" },
  ],
  Trip: [
    { key: "name", label: "Trip name", ph: "Grade 6 science museum visit" },
    { key: "destination", label: "Destination", ph: "Birla Science Museum, Naubat Pahad" },
    { key: "date", label: "Date", ph: "18 September 2026" },
    { key: "depart", label: "Departure time", ph: "8:30 AM" },
    { key: "ret", label: "Expected return", ph: "2:30 PM" },
    { key: "teacher", label: "Teacher in charge", ph: "Meera Krishnan" },
    { key: "consent", label: "Parent consent", ph: "Required" },
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
