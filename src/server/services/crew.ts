import "server-only";
import { db, inParallel, type Tx } from "@/server/db";
import { ApiError, conflict, invalid, notFound, toApiError } from "@/server/http/errors";
import { writeAudit, type Ctx } from "@/server/http/handler";
import { notifyAdmins, notifyGuardians } from "@/server/services/notify";
import { nextIncidentCode } from "@/server/services/safety";
import { oneBusLive } from "@/server/services/tracking";
import { addDays, dbDate, formatDay, formatTime, localDate } from "@/lib/time";
import { readSettings } from "@/lib/api/schemas/settings";
import type {
  CrewMarkView,
  CrewOp,
  CrewPlan,
  CrewStopView,
  CrewStudentView,
  OpResult,
  PhasePlan,
  TripPhaseKey,
} from "@/lib/api/schemas/crew";
import type { MarkStatus, TripPhase } from "@/generated/prisma/client";

/**
 * The attendant's day: which bus, which stops, who rides, what has been
 * marked. `loadCrewPlan` builds it; `applyOps` replays the phone's offline
 * event log against it.
 */

const PHASE: Record<TripPhaseKey, TripPhase> = { morning: "MORNING", evening: "EVENING" };
const MARK_STATUS: Record<MarkStatus, CrewMarkView["status"]> = {
  BOARDED: "boarded",
  DROPPED: "dropped",
  ABSENT: "absent",
};

/** "Green Valley Apartments" → "Green Valley"; "Kondapur Main Road" → "Kondapur". */
export function shortName(name: string): string {
  const words = name.split(/\s+/);
  return words[0]!.length <= 5 && words[1] ? `${words[0]} ${words[1]}` : words[0]!;
}

async function crewWithBus(client: Tx, crewId: string, schoolId: string) {
  const crew = await client.crew.findFirst({
    where: { id: crewId, schoolId, deletedAt: null },
    include: {
      attendingBuses: { where: { deletedAt: null } },
      drivingBuses: { where: { deletedAt: null } },
    },
  });
  if (!crew) throw new ApiError("UNAUTHENTICATED", "Sign in to continue.");
  return { crew, bus: crew.attendingBuses[0] ?? crew.drivingBuses[0] ?? null };
}

// ── Plan ──────────────────────────────────────────────────────────────────

export async function loadCrewPlan(client: Tx, crewId: string, schoolId: string): Promise<CrewPlan> {
  const schoolRow = await client.school.findUniqueOrThrow({ where: { id: schoolId } });
  const settings = readSettings(schoolRow.settings);
  const tz = schoolRow.timezone;
  const date = localDate(new Date(), tz);
  const { crew, bus } = await crewWithBus(client, crewId, schoolId);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [route, riders, trips, sos, weekTrips, weekMarks, weekIncidents, docs] = await inParallel(client, [
    () =>
      bus?.routeId
        ? client.route.findFirst({
            where: { id: bus.routeId, deletedAt: null },
            include: { stops: { include: { stop: true }, orderBy: { sequence: "asc" } } },
          })
        : Promise.resolve(null),
    () =>
      bus
        ? client.student.findMany({ where: { busId: bus.id, deletedAt: null }, orderBy: { name: "asc" } })
        : Promise.resolve([]),
    () =>
      bus
        ? client.trip.findMany({
            where: { busId: bus.id, date: dbDate(date) },
            include: { marks: { where: { undone: false } } },
          })
        : Promise.resolve([]),
    () =>
      bus
        ? client.incident.findFirst({
            where: { schoolId, busId: bus.id, type: "SOS", status: "NEW", occurredAt: { gte: dbDate(date) } },
            orderBy: { occurredAt: "desc" },
          })
        : Promise.resolve(null),
    () =>
      client.trip.count({
        where: { schoolId, status: "COMPLETED", OR: [{ attendantId: crew.id }, { driverId: crew.id }], completedAt: { gte: weekAgo } },
      }),
    () => client.attendanceMark.count({ where: { markedById: crew.id, markedAt: { gte: weekAgo } } }),
    () =>
      bus
        ? client.incident.count({ where: { schoolId, busId: bus.id, occurredAt: { gte: weekAgo } } })
        : Promise.resolve(0),
    () =>
      client.document.findMany({
        where: { schoolId, ownerType: crew.role === "DRIVER" ? "DRIVER" : "ATTENDANT", ownerId: crew.id },
      }),
  ] as const);

  // The riders' absences, fetched now that we know who rides.
  const away = riders.length
    ? await client.absenceRequest.findMany({
        where: { schoolId, date: dbDate(date), cancelledAt: null, studentId: { in: riders.map((r) => r.id) } },
      })
    : [];

  const ordered = route?.stops ?? [];
  const school = ordered[ordered.length - 1];
  const onRoute = new Set(ordered.map((s) => s.stopId));
  const stopName = new Map(ordered.map((s) => [s.stopId, s.stop.name]));

  const stopsFor = (phase: TripPhaseKey): CrewStopView[] => {
    if (!school) return [];
    const rest = ordered.slice(0, -1);
    if (phase === "morning") {
      return rest.map((s) => ({ key: s.stopId, name: s.stop.name, short: shortName(s.stop.name), time: clock(s.pickupTime) }));
    }
    return [
      { key: school.stopId, name: school.stop.name, short: "School", time: clock(school.dropTime), boarding: true },
      ...[...rest].reverse().map((s) => ({ key: s.stopId, name: s.stop.name, short: shortName(s.stop.name), time: clock(s.dropTime) })),
    ];
  };

  const studentsFor = (phase: TripPhaseKey): CrewStudentView[] =>
    riders.map((r) => {
      const a = away.find((x) => x.studentId === r.id && (x.phase === "both" || x.phase === (phase === "morning" ? "am" : "pm")));
      return {
        id: r.id,
        name: r.name,
        cls: `${r.grade} · ${r.section}`,
        // A rider whose stop is not on the route boards at the first stop.
        stop: r.stopId && onRoute.has(r.stopId) ? r.stopId : (ordered[0]?.stopId ?? ""),
        absence: a ? { reason: a.reason } : null,
      };
    });

  const phasePlan = (phase: TripPhaseKey): PhasePlan => {
    const trip = trips.find((t) => t.phase === PHASE[phase]);
    const marks: Record<string, CrewMarkView> = {};
    for (const m of trip?.marks ?? []) {
      const name = (m.stopId && stopName.get(m.stopId)) || "Bus";
      marks[`${m.phase === "BOARD" ? "board" : "drop"}:${m.studentId}`] = {
        status: MARK_STATUS[m.status],
        stop: name,
        short: m.stopId === school?.stopId ? "School" : shortName(name),
        time: formatTime(m.markedAt, tz),
        at: m.markedAt.toISOString(),
        clientMarkId: m.clientMarkId,
      };
    }
    return {
      status: !trip || trip.status === "SCHEDULED" ? "NOT_STARTED" : trip.status === "DELAYED" ? "ACTIVE" : trip.status,
      stops: stopsFor(phase),
      marks,
      students: studentsFor(phase),
      sos: !!sos,
    };
  };

  const running = trips.find((t) => t.status === "ACTIVE");
  const live = bus ? await oneBusLive(client, schoolId, bus.id, running?.phase ?? null).catch(() => null) : null;

  return {
    date,
    live,
    undoWindowMin: settings.undoWindowMin,
    bus: bus
      ? { id: bus.id, label: `Bus ${bus.number}`, reg: bus.registration, route: route?.name ?? null }
      : null,
    phases: { morning: phasePlan("morning"), evening: phasePlan("evening") },
    week: [
      { value: String(weekTrips), label: "Trips run" },
      { value: String(weekMarks), label: "Marks recorded" },
      { value: String(weekIncidents), label: "Incidents" },
    ],
    records: crewRecords(crew.role, docs, date),
  };
}

const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h! % 12 || 12}:${String(m).padStart(2, "0")} ${h! >= 12 ? "PM" : "AM"}`;
};

const RECORD_SPEC = {
  licence: { icon: "badge", label: "Driving licence" },
  police_verification: { icon: "verified_user", label: "Police verification" },
  first_aid: { icon: "medical_services", label: "First aid training" },
  aadhaar: { icon: "description", label: "Aadhaar on record" },
  medical: { icon: "health_and_safety", label: "Medical checkup" },
} as const;

function crewRecords(
  role: "DRIVER" | "ATTENDANT",
  docs: Array<{ kind: string; expiresOn: Date | null; uploadedAt: Date }>,
  today: string,
): CrewPlan["records"] {
  const kinds = role === "DRIVER"
    ? (["licence", "police_verification", "medical"] as const)
    : (["police_verification", "first_aid", "aadhaar", "medical"] as const);
  return kinds.map((kind) => {
    const spec = RECORD_SPEC[kind];
    const doc = docs.find((d) => d.kind === kind);
    if (!doc) return { ...spec, sub: "Ask the transport office to upload it", status: "Missing", tone: "bad" as const };
    if (!doc.expiresOn) return { ...spec, sub: `Uploaded ${formatDay(doc.uploadedAt)}`, status: "On file", tone: "good" as const };
    const exp = doc.expiresOn.toISOString().slice(0, 10);
    if (exp < today) return { ...spec, sub: `Expired ${formatDay(exp)}`, status: "Expired", tone: "bad" as const };
    if (exp <= addDays(today, 30)) return { ...spec, sub: `Due ${formatDay(exp)}`, status: "Due soon", tone: "delayed" as const };
    return { ...spec, sub: `Valid till ${formatDay(exp)}`, status: "On file", tone: "good" as const };
  });
}

// ── Event replay ──────────────────────────────────────────────────────────

/**
 * Apply queued events in order, each in its own transaction. A refused event
 * (validation, conflict) is reported and skipped; an unexpected failure stops
 * the replay so later events never apply ahead of an earlier one. Events not
 * in the result stay queued on the phone.
 */
export async function applyOps(ctx: Ctx, ops: CrewOp[]): Promise<OpResult[]> {
  const results: OpResult[] = [];
  const today = localDate();
  for (const op of ops) {
    const key = `op:${op.opId}`;
    const seen = await db.idempotencyKey.findUnique({
      where: { schoolId_key: { schoolId: ctx.schoolId, key } },
    });
    if (seen) {
      results.push({ opId: op.opId, ok: true });
      continue;
    }
    try {
      if (op.date > today || op.date < addDays(today, -2)) {
        throw invalid("This event is too old to record. Tell the transport office.");
      }
      await db.$transaction(
        async (tx) => {
          const entries: Parameters<typeof writeAudit>[2] = [];
          await applyOp(tx, ctx, op, (e) => entries.push(e));
          await writeAudit(tx, ctx, entries.length ? entries : [{ action: `CREW_${op.type.toUpperCase()}` }]);
          await tx.idempotencyKey.create({
            data: { schoolId: ctx.schoolId, key, route: "/api/crew/sync", status: 200, response: { ok: true } },
          });
        },
        { timeout: 15_000, maxWait: 10_000 },
      );
      results.push({ opId: op.opId, ok: true });
    } catch (error) {
      const api = toApiError(error);
      if (api.code === "INTERNAL") {
        console.error(error);
        break;
      }
      results.push({ opId: op.opId, ok: false, error: api.message });
    }
  }
  return results;
}

type Audit = (e: { action: string; entityType?: string; entityId?: string; meta?: Record<string, string | number | boolean | null> }) => void;

async function tripFor(tx: Tx, ctx: Ctx, op: CrewOp, create: boolean) {
  const { crew, bus } = await crewWithBus(tx, ctx.actor.id, ctx.schoolId);
  if (!bus) throw invalid("You are not assigned to a bus today. Call the transport office.");
  const where = { busId_date_phase: { busId: bus.id, date: dbDate(op.date), phase: PHASE[op.phase] } };
  const trip = await tx.trip.findUnique({ where });
  if (trip || !create) return { trip, bus, crew };
  if (!bus.routeId) throw invalid(`Bus ${bus.number} has no route. Call the transport office.`);
  const created = await tx.trip.create({
    data: {
      schoolId: ctx.schoolId,
      date: dbDate(op.date),
      phase: PHASE[op.phase],
      busId: bus.id,
      routeId: bus.routeId,
      driverId: bus.driverId,
      attendantId: bus.attendantId,
      status: "ACTIVE",
      startedAt: new Date(op.at),
    },
  });
  return { trip: created, bus, crew };
}

async function stopLabel(tx: Tx, stopId: string | null): Promise<string> {
  if (!stopId) return "the bus";
  const stop = await tx.stop.findUnique({ where: { id: stopId }, select: { name: true } });
  return stop?.name ?? "the bus";
}

const first = (name: string) => name.split(" ")[0] ?? name;

async function applyOp(tx: Tx, ctx: Ctx, op: CrewOp, audit: Audit): Promise<void> {
  const at = new Date(op.at);

  if (op.type === "start") {
    const { trip, bus, crew } = await tripFor(tx, ctx, op, true);
    if (trip!.status === "SCHEDULED") {
      await tx.trip.update({ where: { id: trip!.id }, data: { status: "ACTIVE", startedAt: at } });
    }
    if (bus.status !== "MAINTENANCE") await tx.bus.update({ where: { id: bus.id }, data: { status: "ACTIVE" } });
    await tx.crew.update({ where: { id: crew.id }, data: { status: "ON_DUTY" } });
    audit({ action: "START_TRIP", entityType: "Trip", entityId: trip!.id, meta: { phase: op.phase } });
    return;
  }

  if (op.type === "mark") {
    const { trip, bus } = await tripFor(tx, ctx, op, true);
    if (trip!.status === "COMPLETED" && trip!.completedAt && at > trip!.completedAt) {
      throw conflict("This trip is already completed.");
    }
    const student = await tx.student.findFirst({ where: { id: op.studentId, schoolId: ctx.schoolId, deletedAt: null } });
    if (!student || student.busId !== bus.id) throw invalid("This student is not on your bus.");
    const valid = op.markPhase === "board" ? op.status !== "dropped" : op.status === "dropped";
    if (!valid) throw invalid("That mark does not fit this stop.");
    if (op.markPhase === "drop") {
      const boarded = await tx.attendanceMark.findUnique({
        where: { tripId_studentId_phase: { tripId: trip!.id, studentId: student.id, phase: "BOARD" } },
      });
      if (!boarded || boarded.undone || boarded.status !== "BOARDED") {
        throw conflict(`${student.name} was not marked boarded, so cannot be dropped.`);
      }
    }

    const phase = op.markPhase === "board" ? "BOARD" : "DROP";
    const status: MarkStatus = op.status === "boarded" ? "BOARDED" : op.status === "dropped" ? "DROPPED" : "ABSENT";
    const key = { tripId_studentId_phase: { tripId: trip!.id, studentId: student.id, phase } } as const;
    const existing = await tx.attendanceMark.findUnique({ where: key });
    if (existing?.clientMarkId === op.clientMarkId) return;
    if (existing && !existing.undone && existing.markedAt > at) return; // a newer mark already won
    const data = {
      status,
      stopId: op.stopId,
      clientMarkId: op.clientMarkId,
      markedAt: at,
      receivedAt: new Date(),
      markedById: ctx.actor.id,
      undone: false,
    };
    const mark = existing
      ? await tx.attendanceMark.update({ where: { id: existing.id }, data })
      : await tx.attendanceMark.create({ data: { ...data, tripId: trip!.id, studentId: student.id, phase } });

    if (!existing || existing.undone || existing.status !== status) {
      const where = await stopLabel(tx, op.stopId);
      const name = first(student.name);
      await notifyGuardians(tx, ctx.schoolId, student.id, "alerts", {
        type: "attendance",
        at,
        ...(status === "BOARDED"
          ? { title: `${name} boarded the bus`, body: `Marked by attendant ${ctx.actor.name} at ${where}.` }
          : status === "DROPPED"
            ? { title: `${name} was dropped at ${where}`, body: `Dropped by Bus ${bus.number}.` }
            : { title: `${name} marked absent`, body: `Not at ${where} when Bus ${bus.number} arrived.` }),
      });
    }
    audit({ action: "MARK_ATTENDANCE", entityType: "AttendanceMark", entityId: mark.id, meta: { studentId: student.id, phase, status } });
    return;
  }

  if (op.type === "undo") {
    const { trip } = await tripFor(tx, ctx, op, false);
    if (!trip) return;
    const phase = op.markPhase === "board" ? "BOARD" : "DROP";
    const mark = await tx.attendanceMark.findUnique({
      where: { tripId_studentId_phase: { tripId: trip.id, studentId: op.studentId, phase } },
    });
    if (!mark || mark.undone) return;
    const school = await tx.school.findUniqueOrThrow({ where: { id: ctx.schoolId }, select: { settings: true } });
    const windowMs = readSettings(school.settings).undoWindowMin * 60_000;
    if (at.getTime() - mark.markedAt.getTime() > windowMs) {
      throw conflict("The undo window has passed. Ask the transport office to correct it.");
    }
    if (phase === "BOARD") {
      const dropped = await tx.attendanceMark.findUnique({
        where: { tripId_studentId_phase: { tripId: trip.id, studentId: op.studentId, phase: "DROP" } },
      });
      if (dropped && !dropped.undone) throw conflict("Undo the drop first.");
    }
    await tx.attendanceMark.update({ where: { id: mark.id }, data: { undone: true } });
    const student = await tx.student.findUniqueOrThrow({ where: { id: op.studentId }, select: { name: true } });
    await notifyGuardians(tx, ctx.schoolId, op.studentId, "alerts", {
      type: "attendance",
      at,
      title: `Correction for ${first(student.name)}`,
      body: "The attendant corrected the last scan. The next update replaces it.",
    });
    audit({ action: "UNDO_MARK", entityType: "AttendanceMark", entityId: mark.id, meta: { studentId: op.studentId, phase } });
    return;
  }

  if (op.type === "complete") {
    const { trip, bus } = await tripFor(tx, ctx, op, true);
    if (trip!.status === "COMPLETED") return;
    const route = await tx.routeStop.findMany({ where: { routeId: trip!.routeId }, orderBy: { sequence: "desc" }, take: 1 });
    const schoolStop = route[0]?.stopId ?? null;
    if (op.phase === "morning") {
      // Arriving at school drops everyone still on board.
      const marks = await tx.attendanceMark.findMany({ where: { tripId: trip!.id, undone: false } });
      const dropped = new Set(marks.filter((m) => m.phase === "DROP").map((m) => m.studentId));
      const onboard = marks.filter((m) => m.phase === "BOARD" && m.status === "BOARDED" && !dropped.has(m.studentId));
      for (const m of onboard) {
        await tx.attendanceMark.upsert({
          where: { tripId_studentId_phase: { tripId: trip!.id, studentId: m.studentId, phase: "DROP" } },
          create: {
            tripId: trip!.id, studentId: m.studentId, phase: "DROP", status: "DROPPED", stopId: schoolStop,
            clientMarkId: `arrive-${trip!.id}-${m.studentId}`, markedAt: at, markedById: ctx.actor.id,
          },
          update: { status: "DROPPED", undone: false, markedAt: at },
        });
        const s = await tx.student.findUniqueOrThrow({ where: { id: m.studentId }, select: { name: true } });
        await notifyGuardians(tx, ctx.schoolId, m.studentId, "alerts", {
          type: "attendance",
          at,
          title: `${first(s.name)} reached school safely`,
          body: `Bus ${bus.number} arrived at school.`,
        });
      }
    } else {
      const marks = await tx.attendanceMark.findMany({ where: { tripId: trip!.id, undone: false } });
      const dropped = new Set(marks.filter((m) => m.phase === "DROP").map((m) => m.studentId));
      const left = marks.filter((m) => m.phase === "BOARD" && m.status === "BOARDED" && !dropped.has(m.studentId));
      const school = await tx.school.findUniqueOrThrow({ where: { id: ctx.schoolId }, select: { settings: true } });
      if (left.length && readSettings(school.settings).requireDropConfirm) {
        throw conflict(`${left.length} still on board. Mark every drop before completing.`);
      }
    }
    await tx.trip.update({ where: { id: trip!.id }, data: { status: "COMPLETED", completedAt: at } });
    if (bus.status === "ACTIVE" || bus.status === "DELAYED") {
      await tx.bus.update({ where: { id: bus.id }, data: { status: "IDLE" } });
    }
    audit({ action: "COMPLETE_TRIP", entityType: "Trip", entityId: trip!.id, meta: { phase: op.phase } });
    return;
  }

  if (op.type === "sos") {
    const { trip, bus, crew } = await tripFor(tx, ctx, op, false);
    if (op.active) {
      const incident = await tx.incident.create({
        data: {
          schoolId: ctx.schoolId,
          code: await nextIncidentCode(tx, ctx.schoolId),
          busId: bus.id,
          tripId: trip?.id ?? null,
          type: "SOS",
          severity: "CRITICAL",
          status: "NEW",
          description: `Emergency alert raised by ${crew.name} (${crew.crewId}) on Bus ${bus.number} during the ${op.phase} trip.`,
          occurredAt: at,
          assignedTo: "Transport office",
          clipIds: [],
          events: { create: { actorId: crew.id, action: "SOS_RAISED", createdAt: at } },
        },
      });
      await notifyAdmins(tx, ctx.schoolId, {
        type: "alert",
        at,
        title: `SOS on Bus ${bus.number}`,
        body: `${crew.name} raised an emergency alert. Call ${crew.phone}.`,
      });
      audit({ action: "SOS_RAISED", entityType: "Incident", entityId: incident.id, meta: { busId: bus.id } });
      return;
    }
    const open = await tx.incident.findFirst({
      where: { schoolId: ctx.schoolId, busId: bus.id, type: "SOS", status: "NEW" },
      orderBy: { occurredAt: "desc" },
    });
    if (!open) return;
    await tx.incident.update({
      where: { id: open.id },
      data: {
        status: "UNDER_REVIEW",
        events: { create: { actorId: crew.id, action: "SOS_CANCELLED_BY_CREW", note: "Cancelled from the bus.", createdAt: at } },
      },
    });
    audit({ action: "SOS_CANCELLED", entityType: "Incident", entityId: open.id });
    return;
  }

  throw notFound("Event type");
}
