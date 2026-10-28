import "server-only";
import { randomInt } from "node:crypto";
import type { Ctx } from "@/server/http/handler";
import { lockSequence, type Tx } from "@/server/db";
import { conflict, invalid, notFound } from "@/server/http/errors";
import { hashSecret } from "@/server/auth/crypto";
import { dbDate, localDate } from "@/lib/time";
import { CREW_ID_PREFIX } from "@/lib/api/schemas/crew";
import type {
  AttendantInput,
  BusInput,
  DriverInput,
  RouteInput,
  SchoolTripInput,
  StopInput,
  StudentInput,
} from "@/lib/api/schemas/masters";
import type { CrewRole } from "@/generated/prisma/client";
import { ApiError } from "@/server/http/errors";
import { linkDevice } from "@/server/services/tracking";
import { NO_POSITION, resolveLocation } from "@/server/vendors/map-link";

/** Linking a tracker changes vendor-side setup; transport leads only. */
async function applyTracker(ctx: Ctx, busId: string, tracker: BusInput["tracker"]) {
  if (tracker === undefined) return;
  if (ctx.actor.role !== "SUPER_ADMIN" && ctx.actor.role !== "TRANSPORT_MANAGER") {
    throw new ApiError("FORBIDDEN", "Only a super admin or transport manager can change a bus's GPS tracker.");
  }
  await linkDevice(ctx, { busId, vehicleId: tracker.vehicleId });
}

/**
 * Writes for the master records. Every function runs inside the route's
 * transaction (ctx.db), scopes every lookup by ctx.schoolId, and records its
 * own audit row. References from the client are re-checked against the school
 * here: an id from another school reads as "not found".
 *
 * Deletes are soft (deletedAt) so attendance and CCTV history keep their
 * references. A deleted record's unique key (bus number, crew ID) is freed
 * by suffixing it, so the same number can be used again.
 */

// ── Reference checks ──────────────────────────────────────────────────────

async function ownBus(db: Tx, schoolId: string, id: string | null) {
  if (!id) return null;
  const bus = await db.bus.findFirst({ where: { id, schoolId, deletedAt: null } });
  if (!bus) throw invalid("That bus no longer exists.", { busId: "Pick another bus." });
  return bus;
}

async function ownRoute(db: Tx, schoolId: string, id: string | null) {
  if (!id) return null;
  const route = await db.route.findFirst({ where: { id, schoolId, deletedAt: null } });
  if (!route) throw invalid("That route no longer exists.", { routeId: "Pick another route." });
  return route;
}

async function ownStop(db: Tx, schoolId: string, id: string | null) {
  if (!id) return null;
  const stop = await db.stop.findFirst({ where: { id, schoolId, deletedAt: null } });
  if (!stop) throw invalid("That stop no longer exists.", { stopId: "Pick another stop." });
  return stop;
}

async function ownCrew(db: Tx, schoolId: string, id: string | null, role: CrewRole) {
  if (!id) return null;
  const crew = await db.crew.findFirst({ where: { id, schoolId, role, deletedAt: null } });
  const field = role === "DRIVER" ? "driverId" : "attendantId";
  if (!crew) throw invalid(`That ${role === "DRIVER" ? "driver" : "attendant"} no longer exists.`, { [field]: "Pick someone else." });
  return crew;
}

const freed = (key: string) => `${key}~${Date.now().toString(36)}`;

export async function hasActiveTrip(db: Tx, where: { busId?: string; routeId?: string }) {
  const trip = await db.trip.findFirst({ where: { ...where, status: "ACTIVE" } });
  return !!trip;
}

// ── Buses ─────────────────────────────────────────────────────────────────

/** A driver or attendant crews one bus at a time; taking a new one frees the old. */
async function assignCrew(db: Tx, schoolId: string, busId: string, driverId: string | null, attendantId: string | null) {
  if (driverId) {
    await db.bus.updateMany({ where: { schoolId, driverId, id: { not: busId } }, data: { driverId: null } });
  }
  if (attendantId) {
    await db.bus.updateMany({ where: { schoolId, attendantId, id: { not: busId } }, data: { attendantId: null } });
  }
}

/** Mileage, idle burn and service fields: only what the form filled in. */
function costFields(input: BusInput) {
  return {
    ...(input.mileageKmpl !== undefined ? { mileageKmpl: input.mileageKmpl } : {}),
    ...(input.idleLph !== undefined ? { idleLph: input.idleLph } : {}),
    ...(input.serviceEveryKm !== undefined ? { serviceEveryKm: input.serviceEveryKm } : {}),
    ...(input.lastServiceOn !== undefined ? { lastServiceOn: new Date(`${input.lastServiceOn}T00:00:00Z`) } : {}),
  };
}

export async function createBus(ctx: Ctx, input: BusInput) {
  const { db, schoolId } = ctx;
  await ownCrew(db, schoolId, input.driverId, "DRIVER");
  await ownCrew(db, schoolId, input.attendantId, "ATTENDANT");
  await ownRoute(db, schoolId, input.routeId);
  const clash = await db.bus.findFirst({ where: { schoolId, number: input.number } });
  if (clash) throw conflict(`Bus ${input.number} already exists.`, { number: "Already in use." });

  const bus = await db.bus.create({
    data: {
      schoolId,
      number: input.number,
      registration: input.registration,
      capacity: input.capacity,
      driverId: input.driverId,
      attendantId: input.attendantId,
      routeId: input.routeId,
      ...costFields(input),
    },
  });
  await assignCrew(db, schoolId, bus.id, input.driverId, input.attendantId);
  await applyTracker(ctx, bus.id, input.tracker);
  ctx.audit({ action: "CREATE_BUS", entityType: "Bus", entityId: bus.id, meta: { number: bus.number } });
  return bus.id;
}

export async function updateBus(ctx: Ctx, id: string, input: BusInput) {
  const { db, schoolId } = ctx;
  const bus = await db.bus.findFirst({ where: { id, schoolId, deletedAt: null } });
  if (!bus) throw notFound("Bus");
  await ownCrew(db, schoolId, input.driverId, "DRIVER");
  await ownCrew(db, schoolId, input.attendantId, "ATTENDANT");
  await ownRoute(db, schoolId, input.routeId);
  if (input.number !== bus.number) {
    const clash = await db.bus.findFirst({ where: { schoolId, number: input.number, id: { not: id } } });
    if (clash) throw conflict(`Bus ${input.number} already exists.`, { number: "Already in use." });
  }
  const riders = await db.student.count({ where: { busId: id, deletedAt: null } });
  if (input.capacity < riders) {
    throw invalid(`${riders} students ride this bus; capacity cannot be lower.`, { capacity: `At least ${riders}.` });
  }

  await db.bus.update({
    where: { id },
    data: {
      number: input.number,
      registration: input.registration,
      capacity: input.capacity,
      ...costFields(input),
      driverId: input.driverId,
      attendantId: input.attendantId,
      routeId: input.routeId,
    },
  });
  await assignCrew(db, schoolId, id, input.driverId, input.attendantId);
  await applyTracker(ctx, id, input.tracker);
  // Students follow their bus onto its new route.
  if (input.routeId && input.routeId !== bus.routeId) {
    await db.student.updateMany({ where: { busId: id }, data: { routeId: input.routeId } });
  }
  ctx.audit({ action: "UPDATE_BUS", entityType: "Bus", entityId: id, meta: { before: { number: bus.number, driverId: bus.driverId, attendantId: bus.attendantId, routeId: bus.routeId }, after: { ...input, tracker: input.tracker ?? null } } });
  return id;
}

export async function deleteBus(ctx: Ctx, id: string) {
  const { db, schoolId } = ctx;
  const bus = await db.bus.findFirst({ where: { id, schoolId, deletedAt: null } });
  if (!bus) throw notFound("Bus");
  if (await hasActiveTrip(db, { busId: id })) {
    throw conflict(`Bus ${bus.number} is on a trip right now. Delete it after the trip ends.`);
  }
  await db.bus.update({
    where: { id },
    data: { deletedAt: new Date(), number: freed(bus.number), driverId: null, attendantId: null, routeId: null },
  });
  await db.student.updateMany({ where: { busId: id }, data: { busId: null } });
  ctx.audit({ action: "DELETE_BUS", entityType: "Bus", entityId: id, meta: { number: bus.number } });
}

// ── Students ──────────────────────────────────────────────────────────────

/** Find the guardian by phone in this school, or create one. */
async function guardianFor(db: Tx, schoolId: string, name: string, phone: string) {
  const existing = await db.guardian.findFirst({ where: { schoolId, phone } });
  if (existing) {
    return existing.deletedAt || existing.name !== name
      ? db.guardian.update({ where: { id: existing.id }, data: { deletedAt: null, name } })
      : existing;
  }
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { settings: true } });
  const notify = (school.settings as { notify?: object } | null)?.notify;
  return db.guardian.create({ data: { schoolId, name, phone, ...(notify ? { prefs: notify } : {}) } });
}

async function checkStudentRefs(db: Tx, schoolId: string, input: StudentInput) {
  const bus = await ownBus(db, schoolId, input.busId);
  await ownRoute(db, schoolId, input.routeId);
  await ownStop(db, schoolId, input.stopId);
  return bus;
}

async function checkCapacity(db: Tx, bus: { id: string; number: string; capacity: number } | null, exceptStudent?: string) {
  if (!bus) return;
  const riders = await db.student.count({
    where: { busId: bus.id, deletedAt: null, ...(exceptStudent ? { id: { not: exceptStudent } } : {}) },
  });
  if (riders >= bus.capacity) {
    throw conflict(`Bus ${bus.number} is full (${bus.capacity} seats).`, { busId: "No seats left." });
  }
}

export async function createStudent(ctx: Ctx, input: StudentInput) {
  const { db, schoolId } = ctx;
  const bus = await checkStudentRefs(db, schoolId, input);
  await checkCapacity(db, bus);
  // No parent account until there is a confirmed parent mobile: that number is their login.
  const guardian = input.parentName && input.parentPhone ? await guardianFor(db, schoolId, input.parentName, input.parentPhone) : null;
  const student = await db.student.create({
    data: {
      schoolId,
      name: input.name,
      grade: input.cls.grade,
      section: input.cls.section,
      roll: input.roll,
      busId: input.busId,
      routeId: input.routeId ?? bus?.routeId ?? null,
      stopId: input.stopId,
      contactPhone: input.contactPhone ?? null,
      ...(guardian ? { guardians: { create: { guardianId: guardian.id, primary: true } } } : {}),
    },
  });
  ctx.audit({ action: "CREATE_STUDENT", entityType: "Student", entityId: student.id, meta: { name: student.name } });
  return student.id;
}

export async function updateStudent(ctx: Ctx, id: string, input: StudentInput) {
  const { db, schoolId } = ctx;
  const student = await db.student.findFirst({
    where: { id, schoolId, deletedAt: null },
    include: { guardians: { where: { primary: true } } },
  });
  if (!student) throw notFound("Student");
  const bus = await checkStudentRefs(db, schoolId, input);
  if (input.busId && input.busId !== student.busId) await checkCapacity(db, bus, id);

  await db.student.update({
    where: { id },
    data: {
      name: input.name,
      grade: input.cls.grade,
      section: input.cls.section,
      ...(input.roll ? { roll: input.roll } : {}),
      busId: input.busId,
      routeId: input.routeId,
      stopId: input.stopId,
      contactPhone: input.contactPhone ?? null,
    },
  });

  // The primary guardian is whoever owns the number on the form; no number leaves the guardians as they are.
  const guardian = input.parentName && input.parentPhone ? await guardianFor(db, schoolId, input.parentName, input.parentPhone) : null;
  const current = student.guardians[0];
  if (guardian && current?.guardianId !== guardian.id) {
    if (current) {
      await db.studentGuardian.update({
        where: { studentId_guardianId: { studentId: id, guardianId: current.guardianId } },
        data: { primary: false },
      });
    }
    await db.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId: id, guardianId: guardian.id } },
      create: { studentId: id, guardianId: guardian.id, primary: true },
      update: { primary: true },
    });
  }
  ctx.audit({ action: "UPDATE_STUDENT", entityType: "Student", entityId: id, meta: { name: input.name } });
  return id;
}

export async function deleteStudent(ctx: Ctx, id: string) {
  const { db, schoolId } = ctx;
  const student = await db.student.findFirst({ where: { id, schoolId, deletedAt: null } });
  if (!student) throw notFound("Student");
  await db.student.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  ctx.audit({ action: "DELETE_STUDENT", entityType: "Student", entityId: id, meta: { name: student.name } });
}

// ── Crew (drivers and attendants) ─────────────────────────────────────────

const CREW_PREFIX: Record<CrewRole, string> = CREW_ID_PREFIX;

async function nextCrewId(db: Tx, schoolId: string, role: CrewRole): Promise<string> {
  const prefix = CREW_PREFIX[role];
  await lockSequence(db, `crew-id:${schoolId}:${role}`);
  const rows = await db.crew.findMany({ where: { schoolId, crewId: { startsWith: prefix } }, select: { crewId: true } });
  const max = rows.reduce((n, r) => Math.max(n, Number.parseInt(r.crewId.slice(prefix.length), 10) || 0), 100);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/** The new crew member's first PIN. Returned once, for the office to hand over. */
const firstPin = () => String(randomInt(0, 10_000)).padStart(4, "0");

async function setCrewBus(db: Tx, schoolId: string, crewId: string, role: CrewRole, busId: string | null) {
  const field = role === "DRIVER" ? "driverId" : "attendantId";
  await db.bus.updateMany({ where: { schoolId, [field]: crewId, ...(busId ? { id: { not: busId } } : {}) }, data: { [field]: null } });
  if (busId) await db.bus.update({ where: { id: busId }, data: { [field]: crewId } });
}

export async function createCrew(ctx: Ctx, role: CrewRole, input: DriverInput | AttendantInput) {
  const { db, schoolId } = ctx;
  await ownBus(db, schoolId, input.busId);
  const pin = firstPin();
  const crew = await db.crew.create({
    data: {
      schoolId,
      role,
      crewId: await nextCrewId(db, schoolId, role),
      name: input.name,
      phone: input.phone,
      pinHash: await hashSecret(pin),
      pinSetAt: new Date(),
      ...("licenceNo" in input
        ? { licenceNo: input.licenceNo, licenceExpiry: dbDate(input.licenceExpiry) }
        : {}),
    },
  });
  await setCrewBus(db, schoolId, crew.id, role, input.busId);
  ctx.audit({ action: `CREATE_${role}`, entityType: "Crew", entityId: crew.id, meta: { crewId: crew.crewId } });
  return { id: crew.id, crewId: crew.crewId, pin };
}

export async function updateCrew(ctx: Ctx, role: CrewRole, id: string, input: DriverInput | AttendantInput) {
  const { db, schoolId } = ctx;
  const crew = await db.crew.findFirst({ where: { id, schoolId, role, deletedAt: null } });
  if (!crew) throw notFound(role === "DRIVER" ? "Driver" : "Attendant");
  await ownBus(db, schoolId, input.busId);
  await db.crew.update({
    where: { id },
    data: {
      name: input.name,
      phone: input.phone,
      ...("licenceNo" in input
        ? { licenceNo: input.licenceNo, licenceExpiry: dbDate(input.licenceExpiry) }
        : {}),
    },
  });
  await setCrewBus(db, schoolId, id, role, input.busId);
  ctx.audit({ action: `UPDATE_${role}`, entityType: "Crew", entityId: id, meta: { name: input.name } });
  return id;
}

export async function deleteCrew(ctx: Ctx, role: CrewRole, id: string) {
  const { db, schoolId } = ctx;
  const crew = await db.crew.findFirst({ where: { id, schoolId, role, deletedAt: null } });
  if (!crew) throw notFound(role === "DRIVER" ? "Driver" : "Attendant");
  const onTrip = await db.trip.findFirst({
    where: { schoolId, status: "ACTIVE", OR: [{ driverId: id }, { attendantId: id }] },
  });
  if (onTrip) throw conflict(`${crew.name} is on a trip right now. Remove them after it ends.`);
  await setCrewBus(db, schoolId, id, role, null);
  await db.crew.update({ where: { id }, data: { deletedAt: new Date(), crewId: freed(crew.crewId) } });
  // Their sessions end with them.
  await db.session.updateMany({ where: { actorId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  ctx.audit({ action: `DELETE_${role}`, entityType: "Crew", entityId: id, meta: { crewId: crew.crewId } });
}

/** Issue a new PIN, e.g. when an attendant forgets theirs. Unlocks the account. */
export async function resetCrewPin(ctx: Ctx, id: string) {
  const { db, schoolId } = ctx;
  const crew = await db.crew.findFirst({ where: { id, schoolId, deletedAt: null } });
  if (!crew) throw notFound("Crew member");
  const pin = firstPin();
  await db.crew.update({
    where: { id },
    data: { pinHash: await hashSecret(pin), pinSetAt: new Date(), failedLogins: 0, lockedUntil: null },
  });
  await db.session.updateMany({ where: { actorId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  ctx.audit({ action: "RESET_CREW_PIN", entityType: "Crew", entityId: id });
  return { crewId: crew.crewId, pin };
}

// ── Routes and stops ──────────────────────────────────────────────────────

/** Rewrite sequences 1..n in the given order, clear of the unique constraint. */
async function writeSequence(db: Tx, routeStopIds: string[]) {
  for (const [i, id] of routeStopIds.entries()) {
    await db.routeStop.update({ where: { id }, data: { sequence: 10_000 + i } });
  }
  for (const [i, id] of routeStopIds.entries()) {
    await db.routeStop.update({ where: { id }, data: { sequence: i + 1 } });
  }
}

/** An existing stop by id, an existing one by name, or a new one. */
async function stopFor(db: Tx, schoolId: string, row: RouteInput["stops"][number]) {
  if (row.stopId) {
    const stop = await ownStop(db, schoolId, row.stopId);
    if (stop && row.landmark && row.landmark !== stop.landmark) {
      await db.stop.update({ where: { id: stop.id }, data: { landmark: row.landmark } });
    }
    return stop!;
  }
  const byName = await db.stop.findFirst({
    where: { schoolId, deletedAt: null, name: { equals: row.name, mode: "insensitive" } },
  });
  return byName ?? db.stop.create({ data: { schoolId, name: row.name, landmark: row.landmark } });
}

async function writeRouteStops(db: Tx, schoolId: string, routeId: string, rows: RouteInput["stops"]) {
  await db.routeStop.deleteMany({ where: { routeId } });
  for (const [i, row] of rows.entries()) {
    const stop = await stopFor(db, schoolId, row);
    await db.routeStop.create({
      data: { routeId, stopId: stop.id, sequence: i + 1, pickupTime: row.pickup, dropTime: row.drop },
    });
  }
}

export async function createRoute(ctx: Ctx, input: RouteInput) {
  const { db, schoolId } = ctx;
  await ownBus(db, schoolId, input.busId);
  await lockSequence(db, `route-code:${schoolId}`);
  const count = await db.route.count({ where: { schoolId } });
  const route = await db.route.create({
    data: {
      schoolId,
      code: `R${count + 1}`,
      name: input.name,
      zone: input.zone,
      distanceM: input.distance,
      durationS: input.duration,
      status: input.status ?? (input.stops.length >= 2 ? "ACTIVE" : "DRAFT"),
    },
  });
  await writeRouteStops(db, schoolId, route.id, input.stops);
  if (input.busId) await db.bus.update({ where: { id: input.busId }, data: { routeId: route.id } });
  ctx.audit({ action: "CREATE_ROUTE", entityType: "Route", entityId: route.id, meta: { name: route.name, stops: input.stops.length } });
  return route.id;
}

export async function updateRoute(ctx: Ctx, id: string, input: RouteInput) {
  const { db, schoolId } = ctx;
  const route = await db.route.findFirst({ where: { id, schoolId, deletedAt: null } });
  if (!route) throw notFound("Route");
  await ownBus(db, schoolId, input.busId);
  if (await hasActiveTrip(db, { routeId: id })) {
    throw conflict("A bus is running this route right now. Edit its stops after the trip ends.");
  }
  await db.route.update({
    where: { id },
    data: {
      name: input.name,
      zone: input.zone,
      distanceM: input.distance,
      durationS: input.duration,
      ...(input.status ? { status: input.status } : {}),
    },
  });
  await writeRouteStops(db, schoolId, id, input.stops);
  if (input.busId) await db.bus.update({ where: { id: input.busId }, data: { routeId: id } });
  ctx.audit({ action: "UPDATE_ROUTE", entityType: "Route", entityId: id, meta: { name: input.name, stops: input.stops.length } });
  return id;
}

export async function deleteRoute(ctx: Ctx, id: string) {
  const { db, schoolId } = ctx;
  const route = await db.route.findFirst({ where: { id, schoolId, deletedAt: null } });
  if (!route) throw notFound("Route");
  if (await hasActiveTrip(db, { routeId: id })) {
    throw conflict("A bus is running this route right now. Delete it after the trip ends.");
  }
  await db.route.update({ where: { id }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
  await db.bus.updateMany({ where: { routeId: id }, data: { routeId: null } });
  await db.student.updateMany({ where: { routeId: id }, data: { routeId: null } });
  ctx.audit({ action: "DELETE_ROUTE", entityType: "Route", entityId: id, meta: { name: route.name } });
}

/** Swap a stop with its neighbour on one route (PATCH /api/admin/routes/:id/stops). */
export async function moveRouteStop(ctx: Ctx, routeId: string, stopId: string, dir: -1 | 1) {
  const { db, schoolId } = ctx;
  const route = await db.route.findFirst({ where: { id: routeId, schoolId, deletedAt: null } });
  if (!route) throw notFound("Route");
  const rows = await db.routeStop.findMany({ where: { routeId }, orderBy: { sequence: "asc" } });
  const i = rows.findIndex((r) => r.stopId === stopId);
  const j = i + dir;
  if (i < 0) throw notFound("Stop on this route");
  if (j < 0 || j >= rows.length) return routeId;
  [rows[i], rows[j]] = [rows[j]!, rows[i]!];
  await writeSequence(db, rows.map((r) => r.id));
  ctx.audit({ action: "REORDER_ROUTE_STOPS", entityType: "Route", entityId: routeId, meta: { stopId, dir } });
  return routeId;
}

/** Put a stop on a route: before the last stop (the school), with times. */
async function placeOnRoute(db: Tx, routeId: string, stopId: string, pickup?: string, drop?: string) {
  const existing = await db.routeStop.findUnique({ where: { routeId_stopId: { routeId, stopId } } });
  if (existing) {
    if (pickup || drop) {
      await db.routeStop.update({
        where: { id: existing.id },
        data: { ...(pickup ? { pickupTime: pickup } : {}), ...(drop ? { dropTime: drop } : {}) },
      });
    }
    return;
  }
  const rows = await db.routeStop.findMany({ where: { routeId }, orderBy: { sequence: "asc" } });
  const created = await db.routeStop.create({
    data: { routeId, stopId, sequence: 10_000 + rows.length, pickupTime: pickup ?? "07:00", dropTime: drop ?? "16:00" },
  });
  const order = rows.map((r) => r.id);
  order.splice(rows.length >= 2 ? rows.length - 1 : rows.length, 0, created.id);
  await writeSequence(db, order);
}

async function setStopStudents(db: Tx, schoolId: string, stopId: string, routeId: string | null, studentIds: string[]) {
  const owned = await db.student.count({ where: { id: { in: studentIds }, schoolId, deletedAt: null } });
  if (owned !== new Set(studentIds).size) throw invalid("Some students no longer exist. Reopen the form.");
  await db.student.updateMany({
    where: { schoolId, stopId, id: { notIn: studentIds } },
    data: { stopId: null },
  });
  if (studentIds.length) {
    await db.student.updateMany({
      where: { schoolId, id: { in: studentIds } },
      data: { stopId, ...(routeId ? { routeId } : {}) },
    });
  }
}

/** The pin a pasted location gives: coordinates, a Google Maps link, or nothing (keep the pin). */
async function pinFrom(location: string | null | undefined) {
  if (!location?.trim()) return {};
  const at = await resolveLocation(location);
  if (!at) throw invalid(NO_POSITION, { location: NO_POSITION });
  return { lat: at.lat, lng: at.lng };
}

export async function createStop(ctx: Ctx, input: StopInput) {
  const { db, schoolId } = ctx;
  await ownRoute(db, schoolId, input.routeId);
  const clash = await db.stop.findFirst({
    where: { schoolId, deletedAt: null, name: { equals: input.name, mode: "insensitive" } },
  });
  if (clash) throw conflict(`A stop called ${clash.name} already exists.`, { name: "Already in use." });
  const pin = await pinFrom(input.location);
  const stop = await db.stop.create({ data: { schoolId, name: input.name, landmark: input.landmark, ...pin } });
  if (input.routeId) await placeOnRoute(db, input.routeId, stop.id, input.pickup, input.drop);
  await setStopStudents(db, schoolId, stop.id, input.routeId, input.studentIds);
  ctx.audit({ action: "CREATE_STOP", entityType: "Stop", entityId: stop.id, meta: { name: stop.name } });
  return stop.id;
}

export async function updateStop(ctx: Ctx, id: string, input: StopInput) {
  const { db, schoolId } = ctx;
  const stop = await db.stop.findFirst({ where: { id, schoolId, deletedAt: null } });
  if (!stop) throw notFound("Stop");
  await ownRoute(db, schoolId, input.routeId);
  const pin = await pinFrom(input.location);
  await db.stop.update({ where: { id }, data: { name: input.name, landmark: input.landmark, ...pin } });
  if (input.routeId) await placeOnRoute(db, input.routeId, id, input.pickup, input.drop);
  await setStopStudents(db, schoolId, id, input.routeId, input.studentIds);
  ctx.audit({ action: "UPDATE_STOP", entityType: "Stop", entityId: id, meta: { name: input.name } });
  return id;
}

export async function deleteStop(ctx: Ctx, id: string) {
  const { db, schoolId } = ctx;
  const stop = await db.stop.findFirst({ where: { id, schoolId, deletedAt: null }, include: { routes: true } });
  if (!stop) throw notFound("Stop");
  for (const rs of stop.routes) {
    if (await hasActiveTrip(db, { routeId: rs.routeId })) {
      throw conflict("A bus is running a route through this stop. Delete it after the trip ends.");
    }
  }
  await db.routeStop.deleteMany({ where: { stopId: id } });
  for (const rs of stop.routes) {
    const rest = await db.routeStop.findMany({ where: { routeId: rs.routeId }, orderBy: { sequence: "asc" } });
    await writeSequence(db, rest.map((r) => r.id));
  }
  await db.student.updateMany({ where: { stopId: id }, data: { stopId: null } });
  await db.stop.update({ where: { id }, data: { deletedAt: new Date() } });
  ctx.audit({ action: "DELETE_STOP", entityType: "Stop", entityId: id, meta: { name: stop.name } });
}

// ── School trips ──────────────────────────────────────────────────────────

async function writeFleet(db: Tx, schoolId: string, tripId: string, rows: SchoolTripInput["fleet"]) {
  for (const row of rows) {
    await ownBus(db, schoolId, row.busId);
    await ownCrew(db, schoolId, row.driverId, "DRIVER");
    await ownCrew(db, schoolId, row.attendantId, "ATTENDANT");
  }
  await db.schoolTripFleet.deleteMany({ where: { schoolTripId: tripId } });
  if (rows.length) {
    await db.schoolTripFleet.createMany({
      data: rows.map((r) => ({
        schoolTripId: tripId,
        busId: r.busId,
        driverId: r.driverId,
        attendantId: r.attendantId,
        studentCount: r.studentCount,
      })),
    });
  }
}

export async function createSchoolTrip(ctx: Ctx, input: SchoolTripInput) {
  const { db, schoolId } = ctx;
  if (input.date < localDate()) throw invalid("The trip date has passed.", { date: "Pick today or later." });
  await lockSequence(db, `trip-code:${schoolId}`);
  const count = await db.schoolTrip.count({ where: { schoolId } });
  const trip = await db.schoolTrip.create({
    data: {
      schoolId,
      code: `T-${1040 + count + 1}`,
      name: input.name,
      destination: input.destination,
      date: dbDate(input.date),
      departTime: input.departTime,
      returnTime: input.returnTime,
      teacherName: input.teacherName,
      notes: input.notes,
      status: input.status ?? "SCHEDULED",
    },
  });
  await writeFleet(db, schoolId, trip.id, input.fleet);
  ctx.audit({ action: "CREATE_SCHOOL_TRIP", entityType: "SchoolTrip", entityId: trip.id, meta: { name: trip.name } });
  return trip.id;
}

export async function updateSchoolTrip(ctx: Ctx, id: string, input: SchoolTripInput) {
  const { db, schoolId } = ctx;
  const trip = await db.schoolTrip.findFirst({ where: { id, schoolId, deletedAt: null } });
  if (!trip) throw notFound("School trip");
  await db.schoolTrip.update({
    where: { id },
    data: {
      name: input.name,
      destination: input.destination,
      date: dbDate(input.date),
      departTime: input.departTime,
      returnTime: input.returnTime,
      teacherName: input.teacherName,
      notes: input.notes,
      ...(input.status ? { status: input.status } : {}),
    },
  });
  await writeFleet(db, schoolId, id, input.fleet);
  ctx.audit({ action: "UPDATE_SCHOOL_TRIP", entityType: "SchoolTrip", entityId: id, meta: { name: input.name } });
  return id;
}

export async function deleteSchoolTrip(ctx: Ctx, id: string) {
  const { db, schoolId } = ctx;
  const trip = await db.schoolTrip.findFirst({ where: { id, schoolId, deletedAt: null } });
  if (!trip) throw notFound("School trip");
  if (["ON_THE_WAY", "AT_VENUE", "RETURNING"].includes(trip.status)) {
    throw conflict("This trip is under way. Mark it completed or cancelled instead.");
  }
  await db.schoolTrip.update({ where: { id }, data: { deletedAt: new Date() } });
  ctx.audit({ action: "DELETE_SCHOOL_TRIP", entityType: "SchoolTrip", entityId: id, meta: { name: trip.name } });
}
