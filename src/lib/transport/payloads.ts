import type { DialogState } from "./store";
import type { EntityName } from "./types";

/**
 * Admin dialog → API request. The dialog keeps its form as strings (and ids
 * for the select fields); this turns that into the body the matching schema
 * in src/lib/api/schemas/masters.ts parses. The server re-validates all of it.
 */

export const RESOURCE: Record<EntityName, string> = {
  Bus: "buses",
  Student: "students",
  Driver: "drivers",
  Attendant: "attendants",
  Route: "routes",
  Stop: "stops",
  Trip: "school-trips",
};

export function payloadFor(d: DialogState): Record<string, unknown> {
  const v = d.values;
  switch (d.entity) {
    case "Bus":
      return {
        number: v.id,
        registration: v.reg,
        capacity: v.cap,
        driverId: v.driver,
        attendantId: v.attendant,
        routeId: v.route,
      };
    case "Student":
      return {
        name: v.name,
        cls: v.cls,
        busId: v.bus,
        routeId: v.route,
        stopId: v.stop,
        parentName: v.parent,
        parentPhone: v.phone,
      };
    case "Driver":
      return {
        name: v.name,
        phone: v.phone,
        licenceNo: v.licence,
        licenceExpiry: v.expiry,
        busId: v.bus,
      };
    case "Attendant":
      return { name: v.name, phone: v.phone, busId: v.bus };
    case "Route":
      return {
        name: v.name,
        zone: v.zone,
        busId: v.bus,
        distance: v.km,
        duration: v.dur,
        stops: (d.stopRows ?? [])
          .filter((r) => r.name.trim())
          .map((r) => ({
            stopId: r.stopId ?? "",
            name: r.name.trim(),
            pickup: r.time,
            drop: r.drop,
            landmark: r.landmark ?? "",
          })),
      };
    case "Stop":
      return {
        name: v.name,
        landmark: v.landmark,
        routeId: v.route,
        ...(v.time ? { pickup: v.time } : {}),
        ...(v.drop ? { drop: v.drop } : {}),
        studentIds: d.studentIds,
      };
    case "Trip":
      return {
        name: v.name,
        destination: v.destination,
        date: v.date,
        departTime: v.depart,
        returnTime: v.ret,
        teacherName: v.teacher,
        notes: v.notes,
        fleet: (d.fleetRows ?? [])
          .filter((r) => r.busId)
          .map((r) => ({
            busId: r.busId,
            driverId: r.driverId,
            attendantId: r.attendantId,
            studentCount: r.students || "0",
          })),
      };
  }
}

/**
 * Server field paths → dialog field keys, so an error lands under the input
 * that caused it ("parentPhone" is the "phone" input, "stops.2.name" is row 3).
 */
const FIELD_ALIAS: Record<string, string> = {
  number: "id",
  registration: "reg",
  capacity: "cap",
  driverId: "driver",
  attendantId: "attendant",
  routeId: "route",
  busId: "bus",
  stopId: "stop",
  parentName: "parent",
  parentPhone: "phone",
  licenceNo: "licence",
  licenceExpiry: "expiry",
  distance: "km",
  duration: "dur",
  departTime: "depart",
  returnTime: "ret",
  teacherName: "teacher",
  pickup: "time",
};

export function dialogErrors(fields: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, message] of Object.entries(fields ?? {})) {
    const [head, ...rest] = path.split(".");
    const key = rest.length ? `${head}.${rest.map((p) => FIELD_ALIAS[p] ?? p).join(".")}` : (FIELD_ALIAS[head!] ?? head!);
    out[key] ??= message;
  }
  return out;
}
