import "server-only";
import { formatCoords } from "@/lib/location";
import { inParallel, type Tx } from "@/server/db";
import { clockLabel, dayOf, dbDate, formatDay, formatDayLong, formatTime, localDate } from "@/lib/time";
import type { ToneKind } from "@/lib/transport/tone";
import type {
  Attendant,
  Bus,
  BusDocuments,
  Driver,
  Route,
  SchoolTrip,
  Stop,
  Student,
  TransportData,
} from "@/lib/transport/types";
import type {
  BusStatus,
  CrewStatus,
  MarkStatus,
  RouteStatus,
  SchoolTripStatus,
} from "@/generated/prisma/client";

/**
 * Reads a school's master records and today's activity, and shapes them into
 * the admin console's view models (src/lib/transport/types.ts). One query
 * batch per call: a school has tens of buses and hundreds of students, so the
 * whole set is small enough to send in one response.
 */

export interface AdminData extends TransportData {
  busDocs: BusDocuments;
}

export const bytesLabel = (n: number) =>
  n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

const BUS_STATUS: Record<BusStatus, { label: string; kind: ToneKind }> = {
  ACTIVE: { label: "On Time", kind: "ontime" },
  DELAYED: { label: "Delayed", kind: "delayed" },
  OFFLINE: { label: "GPS Offline", kind: "offline" },
  IDLE: { label: "Idle", kind: "offline" },
  MAINTENANCE: { label: "Maintenance", kind: "offline" },
};

const ROUTE_STATUS: Record<RouteStatus, { label: string; kind: ToneKind }> = {
  ACTIVE: { label: "Active", kind: "good" },
  DRAFT: { label: "Draft", kind: "offline" },
  ARCHIVED: { label: "Archived", kind: "offline" },
};

const CREW_STATUS: Record<CrewStatus, { label: string; kind: ToneKind }> = {
  ON_DUTY: { label: "On duty", kind: "good" },
  IDLE: { label: "Idle", kind: "offline" },
  OFF_DUTY: { label: "Off duty", kind: "offline" },
  SUSPENDED: { label: "Suspended", kind: "bad" },
};

export const SCHOOL_TRIP_STATUS: Record<SchoolTripStatus, { label: string; kind: ToneKind }> = {
  DRAFT: { label: "Draft", kind: "offline" },
  SCHEDULED: { label: "Scheduled", kind: "delayed" },
  ON_THE_WAY: { label: "On the way", kind: "ontime" },
  AT_VENUE: { label: "At venue", kind: "ontime" },
  RETURNING: { label: "Returning", kind: "ontime" },
  COMPLETED: { label: "Completed", kind: "good" },
  CANCELLED: { label: "Cancelled", kind: "bad" },
};

const MARK_LABEL: Record<MarkStatus, string> = {
  BOARDED: "Boarded",
  DROPPED: "Dropped",
  ABSENT: "Absent",
};

/** "+919849021145" → "+91 98490 21145" */
export const phoneLabel = (e164: string) =>
  e164.replace(/^\+91(\d{5})(\d{5})$/, "+91 $1 $2");

function licence(expiry: Date | null, today: string): { label: string; kind: ToneKind } {
  if (!expiry) return { label: "No expiry on file", kind: "delayed" };
  const days = Math.round((expiry.getTime() - dbDate(today).getTime()) / 86_400_000);
  if (days < 0) return { label: "Expired", kind: "bad" };
  if (days <= 60) return { label: `Expires in ${days} days`, kind: "delayed" };
  return { label: `Valid · ${expiry.getUTCFullYear()}`, kind: "good" };
}

export async function loadAdminData(db: Tx, schoolId: string): Promise<AdminData> {
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
  const tz = school.timezone;
  const today = localDate(new Date(), tz);

  const [buses, routes, stops, students, crew, schoolTrips, todaysTrips, absences, docs] =
    await inParallel(db, [
      () => db.bus.findMany({
        where: { schoolId, deletedAt: null },
        include: {
          driver: true,
          attendant: true,
          route: true,
          cameras: { select: { status: true } },
          _count: { select: { students: { where: { deletedAt: null } } } },
        },
        orderBy: { number: "asc" },
      }),
      () => db.route.findMany({
        where: { schoolId, deletedAt: null },
        include: {
          stops: { include: { stop: true }, orderBy: { sequence: "asc" } },
          buses: { where: { deletedAt: null }, orderBy: { number: "asc" } },
          _count: { select: { students: { where: { deletedAt: null } } } },
        },
        orderBy: [{ code: "asc" }, { createdAt: "asc" }],
      }),
      () => db.stop.findMany({
        where: { schoolId, deletedAt: null },
        include: {
          routes: {
            where: { route: { deletedAt: null } },
            include: { route: true },
            orderBy: { route: { code: "asc" } },
          },
          _count: { select: { students: { where: { deletedAt: null } } } },
        },
        orderBy: { createdAt: "asc" },
      }),
      () => db.student.findMany({
        where: { schoolId, deletedAt: null },
        include: {
          bus: true,
          route: true,
          stop: true,
          guardians: { include: { guardian: true }, orderBy: { primary: "desc" } },
        },
        orderBy: { name: "asc" },
      }),
      () => db.crew.findMany({
        where: { schoolId, deletedAt: null },
        include: {
          drivingBuses: { where: { deletedAt: null }, include: { route: true } },
          attendingBuses: { where: { deletedAt: null }, include: { route: true } },
        },
        orderBy: { name: "asc" },
      }),
      () => db.schoolTrip.findMany({
        where: { schoolId, deletedAt: null },
        include: { fleet: true, manifest: true },
        orderBy: { date: "desc" },
      }),
      () => db.trip.findMany({
        where: { schoolId, date: dbDate(today) },
        include: { marks: { where: { undone: false } } },
      }),
      () => db.absenceRequest.findMany({
        where: { schoolId, date: dbDate(today), cancelledAt: null },
      }),
      () => db.document.findMany({
        where: { schoolId, ownerType: { in: ["BUS", "DRIVER"] } },
        orderBy: { uploadedAt: "asc" },
      }),
    ] as const);

  const busById = new Map(buses.map((b) => [b.id, b]));
  const crewById = new Map(crew.map((c) => [c.id, c]));
  const busLabel = (id: string | null) => {
    const b = id ? busById.get(id) : undefined;
    return b ? `Bus ${b.number}` : "Unassigned";
  };

  // Today's trip per bus: the active one, else the most recent.
  const tripFor = new Map<string, (typeof todaysTrips)[number]>();
  for (const t of todaysTrips) {
    const seen = tripFor.get(t.busId);
    if (!seen || t.status === "ACTIVE" || (seen.status !== "ACTIVE" && t.phase === "EVENING")) {
      tripFor.set(t.busId, t);
    }
  }

  // Each student's furthest mark per trip today: a drop outranks a board.
  type Slot = { status: MarkStatus; at: Date; drop: boolean };
  const studentMarks = new Map<string, { am?: Slot; pm?: Slot }>();
  for (const t of todaysTrips) {
    for (const m of t.marks) {
      const entry = studentMarks.get(m.studentId) ?? {};
      const slot = t.phase === "MORNING" ? "am" : "pm";
      const prev = entry[slot];
      const drop = m.phase === "DROP";
      if (!prev || (drop && !prev.drop) || (drop === prev.drop && m.markedAt > prev.at)) {
        entry[slot] = { status: m.status, at: m.markedAt, drop };
      }
      studentMarks.set(m.studentId, entry);
    }
  }
  const absentToday = new Map(absences.map((a) => [a.studentId, a.phase]));

  const viewBuses: Bus[] = buses.map((b) => {
    const trip = tripFor.get(b.id);
    const boarded = trip?.marks.filter((m) => m.phase === "BOARD" && m.status === "BOARDED").length ?? 0;
    const dropped = trip?.marks.filter((m) => m.phase === "DROP" && m.status === "DROPPED").length ?? 0;
    const onboard = trip?.status === "ACTIVE" ? Math.max(0, boarded - dropped) : 0;
    const status = BUS_STATUS[b.status];
    const delay = trip?.delayMin ?? 0;
    return {
      id: b.number,
      uid: b.id,
      driverId: b.driverId,
      attendantId: b.attendantId,
      routeId: b.routeId,
      reg: b.registration,
      cap: String(b.capacity),
      driver: b.driver?.name ?? "Unassigned",
      attendant: b.attendant?.name ?? "Unassigned",
      route: b.route?.name ?? "—",
      onboard,
      cams: { online: b.cameras.filter((c) => c.status === "ONLINE").length, total: b.cameras.length },
      gpsLinked: b.gpsDeviceId !== null,
      kind: b.status === "DELAYED" || delay > 0 ? "delayed" : status.kind,
      status: delay > 0 ? `Delayed ${delay} min` : status.label,
    };
  });

  const viewRoutes: Route[] = routes.map((r, i) => {
    const status = ROUTE_STATUS[r.status];
    return {
      id: r.id,
      code: r.code ?? `R${i + 1}`,
      busId: r.buses[0]?.id ?? null,
      name: r.name,
      bus: r.buses.length ? r.buses.map((b) => `Bus ${b.number}`).join(", ") : "Unassigned",
      zone: r.zone ?? "—",
      stopCount: String(r.stops.length),
      students: String(r._count.students),
      km: r.distanceM ? `${(r.distanceM / 1000).toFixed(1)} km` : "—",
      dur: r.durationS ? `${Math.round(r.durationS / 60)} min` : "—",
      kind: status.kind,
      status: status.label,
    };
  });

  // Stops in route order, then the ones on no route.
  const routeOrder = new Map(routes.map((r, i) => [r.id, i]));
  const viewStops: Stop[] = stops
    .map((s) => {
      const on = [...s.routes].sort(
        (a, b) => (routeOrder.get(a.routeId) ?? 0) - (routeOrder.get(b.routeId) ?? 0),
      );
      const first = on[0];
      const n = s._count.students;
      return {
        sortRoute: first ? (routeOrder.get(first.routeId) ?? 99) : 999,
        sortSeq: first?.sequence ?? 0,
        view: {
          id: s.id,
          routeId: first?.routeId ?? null,
          routeIds: on.map((r) => r.routeId),
          onRoutes: Object.fromEntries(
            on.map((r) => [r.routeId, { seq: r.sequence, time: clockLabel(r.pickupTime), drop: clockLabel(r.dropTime) }]),
          ),
          name: s.name,
          route: first ? first.route.name + (on.length > 1 ? ` +${on.length - 1}` : "") : "Unassigned",
          time: first ? clockLabel(first.pickupTime) : "—",
          drop: first ? clockLabel(first.dropTime) : "—",
          students: n === 0 && on.length > 1 ? "Arrival" : `${n} ${n === 1 ? "student" : "students"}`,
          landmark: s.landmark ?? "",
          location: s.lat != null && s.lng != null ? formatCoords({ lat: s.lat, lng: s.lng }) : "",
        } satisfies Stop,
      };
    })
    .sort((a, b) => a.sortRoute - b.sortRoute || a.sortSeq - b.sortSeq)
    .map((x) => x.view);

  const viewStudents: Student[] = students.map((s) => {
    const marks = studentMarks.get(s.id);
    const away = absentToday.get(s.id);
    const am = marks?.am ? MARK_LABEL[marks.am.status] : away === "am" || away === "both" ? "Absent" : "Pending";
    const pm = marks?.pm ? MARK_LABEL[marks.pm.status] : away === "pm" || away === "both" ? "Absent" : "Pending";
    const last = [marks?.am?.at, marks?.pm?.at].filter((d): d is Date => !!d).sort((a, b) => +b - +a)[0];
    const guardian = s.guardians[0]?.guardian;
    return {
      id: s.id,
      busId: s.busId,
      routeId: s.routeId,
      stopId: s.stopId,
      name: s.name,
      cls: `${s.grade} · ${s.section}`,
      bus: s.bus && !s.bus.deletedAt ? `Bus ${s.bus.number}` : "Unassigned",
      route: s.route && !s.route.deletedAt ? s.route.name : "Unassigned",
      stop: s.stop && !s.stop.deletedAt ? s.stop.name : "Unassigned",
      // Blank, not "—": these fill the edit form, and a student may have no parent account yet.
      parent: guardian?.name ?? "",
      phone: guardian ? phoneLabel(guardian.phone) : "",
      contact: s.contactPhone ? phoneLabel(s.contactPhone) : "",
      am,
      pm,
      updated: last ? formatTime(last, tz) : "—",
    };
  });

  const licenceDocs = new Map(
    docs.filter((d) => d.ownerType === "DRIVER" && d.kind === "licence").map((d) => [d.ownerId, d]),
  );

  const drivers: Driver[] = crew
    .filter((c) => c.role === "DRIVER")
    .map((c) => {
      const bus = c.drivingBuses[0];
      const trip = bus ? tripFor.get(bus.id) : undefined;
      const onSchoolTrip = schoolTrips.some(
        (t) => dayOf(t.date) === today && t.status === "ON_THE_WAY" && t.fleet.some((f) => f.driverId === c.id),
      );
      const status = CREW_STATUS[c.status];
      const lic = licence(c.licenceExpiry, today);
      const doc = licenceDocs.get(c.id);
      return {
        id: c.id,
        crewId: c.crewId,
        busId: bus?.id ?? null,
        name: c.name,
        bus: bus ? `Bus ${bus.number}` : "Unassigned",
        phone: phoneLabel(c.phone),
        licence: c.licenceNo ?? "—",
        expiry: c.licenceExpiry ? formatDay(dayOf(c.licenceExpiry)) : "—",
        ...(doc ? { licenceDoc: `${doc.fileName} · ${bytesLabel(doc.sizeBytes)}` } : {}),
        today: onSchoolTrip
          ? "On school trip"
          : trip?.status === "ACTIVE"
            ? `On trip · ${trip.phase === "MORNING" ? "Morning" : "Evening"}`
            : trip?.status === "COMPLETED"
              ? `Completed · ${trip.phase === "MORNING" ? "Morning" : "Evening"}`
              : c.status === "OFF_DUTY"
                ? "Off duty"
                : "Not started",
        score: c.safetyScore ?? 100,
        kind: status.kind,
        status: status.label,
        licKind: lic.kind,
        licLabel: lic.label,
      };
    });

  const attendants: Attendant[] = crew
    .filter((c) => c.role === "ATTENDANT")
    .map((c) => {
      const bus = c.attendingBuses[0];
      const trip = bus ? tripFor.get(bus.id) : undefined;
      const total = bus ? (busById.get(bus.id)?._count.students ?? 0) : 0;
      const phase = trip?.phase === "EVENING" ? "DROP" : "BOARD";
      const done = trip ? new Set(trip.marks.filter((m) => m.phase === phase).map((m) => m.studentId)).size : 0;
      const marking = trip?.status === "ACTIVE";
      return {
        id: c.id,
        crewId: c.crewId,
        busId: bus?.id ?? null,
        routeId: bus?.routeId ?? null,
        name: c.name,
        bus: bus ? `Bus ${bus.number}` : "Unassigned",
        route: bus?.route?.name ?? "Unassigned",
        phone: phoneLabel(c.phone),
        done,
        total,
        kind: marking || trip?.status === "COMPLETED" ? "good" : CREW_STATUS[c.status].kind === "bad" ? "bad" : "offline",
        status: marking ? "Marking" : trip?.status === "COMPLETED" ? "Done" : c.status === "SUSPENDED" ? "Suspended" : "Not started",
      };
    });

  const trips: SchoolTrip[] = schoolTrips.map((t, i) => {
    const consented = t.manifest.filter((m) => m.consentAt).length;
    const status = SCHOOL_TRIP_STATUS[t.status];
    return {
      id: t.id,
      code: t.code ?? `T-${1000 + i}`,
      name: t.name,
      destination: t.destination,
      date: formatDayLong(dayOf(t.date)),
      depart: clockLabel(t.departTime),
      ret: clockLabel(t.returnTime),
      teacher: t.teacherName,
      consent: !t.manifest.length
        ? "Not collected"
        : consented === t.manifest.length
          ? "All received"
          : `${consented} of ${t.manifest.length} received`,
      notes: t.notes ?? "",
      kind: status.kind,
      status: status.label,
      fleet: t.fleet.map((f) => ({
        id: f.id,
        busId: f.busId,
        driverId: f.driverId ?? "",
        attendantId: f.attendantId ?? "",
        bus: busLabel(f.busId),
        driver: f.driverId ? (crewById.get(f.driverId)?.name ?? "Unassigned") : "Unassigned",
        attendant: f.attendantId ? (crewById.get(f.attendantId)?.name ?? "Unassigned") : "Unassigned",
        students: String(f.studentCount),
      })),
    };
  });

  const busDocs: BusDocuments = {};
  for (const b of buses) busDocs[b.number] = {};
  for (const d of docs) {
    if (d.ownerType !== "BUS") continue;
    const bus = busById.get(d.ownerId);
    if (!bus) continue;
    busDocs[bus.number]![d.kind] = {
      id: d.id,
      file: d.fileName,
      size: bytesLabel(d.sizeBytes),
      on: formatDay(d.issuedOn ? dayOf(d.issuedOn) : d.uploadedAt, tz),
      exp: d.expiresOn ? formatDay(dayOf(d.expiresOn)) : "—",
    };
  }

  return {
    buses: viewBuses,
    routes: viewRoutes,
    stops: viewStops,
    students: viewStudents,
    drivers,
    attendants,
    trips,
    busDocs,
  };
}
