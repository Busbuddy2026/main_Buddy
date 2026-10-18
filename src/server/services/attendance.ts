import "server-only";
import { z } from "zod";
import { inParallel, type Tx } from "@/server/db";
import type { Ctx } from "@/server/http/handler";
import { conflict, invalid, notFound } from "@/server/http/errors";
import { notifyGuardians } from "@/server/services/notify";
import { addDays, dayOf, dbDate, formatDay, formatTime, localDate } from "@/lib/time";
import type { MarkStatus, TripPhase } from "@/generated/prisma/client";
import type { StudentJourney } from "@/lib/api/types";

/**
 * The attendance centre (README §5): today's tallies, daily history, parent
 * absence notices, office corrections and the CSV export. Everything is
 * computed from AttendanceMark rows; nothing is stored twice.
 */

export interface DaySummary {
  date: string;
  expected: number;
  boarded: number;
  absent: number;
  dropped: number;
  pending: number;
}

export interface AbsenceRow {
  id: string;
  student: string;
  cls: string;
  bus: string;
  date: string;
  dateLabel: string;
  phase: "am" | "pm" | "both";
  reason: string | null;
  parent: string;
  acknowledged: boolean;
  createdAt: string;
}

/** Tallies per school day, from the marks of that day's trips. */
export async function summarize(db: Tx, schoolId: string, from: string, to: string): Promise<DaySummary[]> {
  const [riders, trips, absences] = await inParallel(db, [
    () => db.student.count({ where: { schoolId, deletedAt: null, busId: { not: null } } }),
    () =>
      db.trip.findMany({
        where: { schoolId, date: { gte: dbDate(from), lte: dbDate(to) } },
        select: { date: true, phase: true, marks: { where: { undone: false }, select: { studentId: true, phase: true, status: true } } },
      }),
    () =>
      db.absenceRequest.findMany({
        where: { schoolId, cancelledAt: null, date: { gte: dbDate(from), lte: dbDate(to) }, phase: { in: ["am", "both"] } },
        select: { date: true, studentId: true },
      }),
  ] as const);

  const days = new Map<string, { boarded: Set<string>; absent: Set<string>; dropped: Set<string> }>();
  const day = (d: string) => {
    let v = days.get(d);
    if (!v) days.set(d, (v = { boarded: new Set(), absent: new Set(), dropped: new Set() }));
    return v;
  };
  for (const t of trips) {
    const d = day(dayOf(t.date));
    for (const m of t.marks) {
      if (t.phase === "MORNING" && m.phase === "BOARD") {
        (m.status === "ABSENT" ? d.absent : d.boarded).add(m.studentId);
      }
      if (t.phase === "EVENING" && m.phase === "DROP" && m.status === "DROPPED") d.dropped.add(m.studentId);
    }
  }
  for (const a of absences) {
    const d = day(dayOf(a.date));
    if (!d.boarded.has(a.studentId)) d.absent.add(a.studentId);
  }

  const out: DaySummary[] = [];
  for (let d = to; d >= from; d = addDays(d, -1)) {
    const v = days.get(d);
    if (!v) continue;
    out.push({
      date: d,
      expected: riders,
      boarded: v.boarded.size,
      absent: v.absent.size,
      dropped: v.dropped.size,
      pending: Math.max(0, riders - v.boarded.size - v.absent.size),
    });
  }
  return out;
}

export async function todaySummary(db: Tx, schoolId: string): Promise<DaySummary> {
  const today = localDate();
  const [row] = await summarize(db, schoolId, today, today);
  if (row) return row;
  const riders = await db.student.count({ where: { schoolId, deletedAt: null, busId: { not: null } } });
  return { date: today, expected: riders, boarded: 0, absent: 0, dropped: 0, pending: riders };
}

export async function listAbsences(db: Tx, schoolId: string, from: string): Promise<AbsenceRow[]> {
  const rows = await db.absenceRequest.findMany({
    where: { schoolId, cancelledAt: null, date: { gte: dbDate(from) } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    take: 200,
  });
  if (!rows.length) return [];
  const [students, guardians] = await inParallel(db, [
    () => db.student.findMany({ where: { id: { in: rows.map((r) => r.studentId) } }, include: { bus: true } }),
    () => db.guardian.findMany({ where: { id: { in: rows.map((r) => r.guardianId) } } }),
  ] as const);
  return rows.map((r) => {
    const s = students.find((x) => x.id === r.studentId);
    return {
      id: r.id,
      student: s?.name ?? "Removed student",
      cls: s ? `${s.grade} · ${s.section}` : "",
      bus: s?.bus ? `Bus ${s.bus.number}` : "—",
      date: dayOf(r.date),
      dateLabel: formatDay(dayOf(r.date)),
      phase: (r.phase as AbsenceRow["phase"]) ?? "both",
      reason: r.reason,
      parent: guardians.find((g) => g.id === r.guardianId)?.name ?? "—",
      acknowledged: !!r.acknowledgedAt,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function acknowledgeAbsence(ctx: Ctx, id: string) {
  const row = await ctx.db.absenceRequest.findFirst({ where: { id, schoolId: ctx.schoolId } });
  if (!row) throw notFound("Absence request");
  if (!row.acknowledgedAt) {
    await ctx.db.absenceRequest.update({ where: { id }, data: { acknowledgedAt: new Date() } });
  }
  ctx.audit({ action: "ACK_ABSENCE", entityType: "AbsenceRequest", entityId: id });
}

// ── Office corrections ────────────────────────────────────────────────────

export const correctionSchema = z.object({
  studentId: z.string().min(1),
  date: z.iso.date(),
  phase: z.enum(["morning", "evening"]),
  markPhase: z.enum(["board", "drop"]),
  /** null clears the mark. */
  status: z.enum(["boarded", "dropped", "absent"]).nullable(),
  note: z.string().trim().min(3, "Say why the record is being corrected.").max(300),
});

/**
 * The transport office fixes a record the crew can no longer undo. The trip
 * is created if the bus never ran it in the app. Parents get the corrected
 * status; the audit row keeps the before and after.
 */
export async function correctMark(ctx: Ctx, input: z.infer<typeof correctionSchema>) {
  const { db, schoolId } = ctx;
  if (input.date > localDate()) throw invalid("Attendance cannot be recorded ahead of the day.");
  const student = await db.student.findFirst({ where: { id: input.studentId, schoolId, deletedAt: null }, include: { bus: true } });
  if (!student) throw notFound("Student");
  if (!student.bus || !student.bus.routeId) throw conflict(`${student.name} has no bus and route to record against.`);
  const ok = input.status === null || (input.markPhase === "board" ? input.status !== "dropped" : input.status === "dropped");
  if (!ok) throw invalid("That status does not fit this part of the trip.");

  const phase: TripPhase = input.phase === "morning" ? "MORNING" : "EVENING";
  const trip =
    (await db.trip.findUnique({ where: { busId_date_phase: { busId: student.bus.id, date: dbDate(input.date), phase } } })) ??
    (await db.trip.create({
      data: {
        schoolId, date: dbDate(input.date), phase, busId: student.bus.id, routeId: student.bus.routeId,
        driverId: student.bus.driverId, attendantId: student.bus.attendantId,
        status: input.date < localDate() ? "COMPLETED" : "ACTIVE",
      },
    }));
  const markPhase = input.markPhase === "board" ? "BOARD" : "DROP";
  const key = { tripId_studentId_phase: { tripId: trip.id, studentId: student.id, phase: markPhase } } as const;
  const before = await db.attendanceMark.findUnique({ where: key });

  if (input.status === null) {
    if (before && !before.undone) await db.attendanceMark.update({ where: { id: before.id }, data: { undone: true } });
  } else {
    const status: MarkStatus = input.status === "boarded" ? "BOARDED" : input.status === "dropped" ? "DROPPED" : "ABSENT";
    const data = {
      status, stopId: student.stopId, markedAt: new Date(), receivedAt: new Date(),
      markedById: ctx.actor.id, undone: false, clientMarkId: `office-${crypto.randomUUID()}`,
    };
    if (before) await db.attendanceMark.update({ where: { id: before.id }, data });
    else await db.attendanceMark.create({ data: { ...data, tripId: trip.id, studentId: student.id, phase: markPhase } });
  }

  const first = student.name.split(" ")[0];
  await notifyGuardians(db, schoolId, student.id, "alerts", {
    type: "attendance",
    title: `Attendance updated for ${first}`,
    body: input.status
      ? `The transport office recorded ${first} as ${input.status} for the ${input.phase} trip.`
      : `The transport office cleared the ${input.phase} trip record for ${first}.`,
  });
  ctx.audit({
    action: "CORRECT_ATTENDANCE",
    entityType: "Student",
    entityId: student.id,
    meta: {
      date: input.date, phase: input.phase, markPhase: input.markPhase, note: input.note,
      before: before && !before.undone ? before.status : null, after: input.status,
    },
  });
}

// ── Export ────────────────────────────────────────────────────────────────

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** One row per student per trip, in the school's timezone. */
export async function exportCsv(db: Tx, schoolId: string, from: string, to: string): Promise<string> {
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { timezone: true } });
  const trips = await db.trip.findMany({
    where: { schoolId, date: { gte: dbDate(from), lte: dbDate(to) } },
    include: {
      bus: { select: { number: true } },
      marks: { where: { undone: false }, include: { student: { select: { name: true, grade: true, section: true, roll: true } } } },
    },
    orderBy: [{ date: "asc" }, { phase: "asc" }],
  });
  const stops = new Map(
    (await db.stop.findMany({ where: { schoolId }, select: { id: true, name: true } })).map((s) => [s.id, s.name]),
  );
  const crewIds = [...new Set(trips.flatMap((t) => t.marks.map((m) => m.markedById)))];
  const people = new Map(
    [
      ...(await db.crew.findMany({ where: { id: { in: crewIds } }, select: { id: true, name: true } })),
      ...(await db.adminUser.findMany({ where: { id: { in: crewIds } }, select: { id: true, name: true } })),
    ].map((p) => [p.id, p.name]),
  );

  const lines = [
    ["Date", "Trip", "Bus", "Student", "Class", "Roll", "Board status", "Board stop", "Board time", "Drop status", "Drop stop", "Drop time", "Marked by"].join(","),
  ];
  for (const t of trips) {
    const byStudent = new Map<string, typeof t.marks>();
    for (const m of t.marks) byStudent.set(m.studentId, [...(byStudent.get(m.studentId) ?? []), m]);
    for (const marks of byStudent.values()) {
      const board = marks.find((m) => m.phase === "BOARD");
      const drop = marks.find((m) => m.phase === "DROP");
      const s = (board ?? drop)!.student;
      lines.push(
        [
          dayOf(t.date),
          t.phase === "MORNING" ? "Morning" : "Evening",
          `Bus ${t.bus.number}`,
          s.name,
          `${s.grade} ${s.section}`,
          s.roll ?? "",
          board?.status ?? "",
          board?.stopId ? (stops.get(board.stopId) ?? "") : "",
          board ? formatTime(board.markedAt, school.timezone) : "",
          drop?.status ?? "",
          drop?.stopId ? (stops.get(drop.stopId) ?? "") : "",
          drop ? formatTime(drop.markedAt, school.timezone) : "",
          people.get((board ?? drop)!.markedById) ?? "",
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return lines.join("\n") + "\n";
}

export const rangeSchema = z
  .object({ from: z.iso.date().optional(), to: z.iso.date().optional() })
  .transform((r) => {
    const to = r.to ?? localDate();
    const from = r.from ?? addDays(to, -13);
    return { from: from <= to ? from : to, to };
  })
  .refine((r) => addDays(r.from, 366) >= r.to, "Export at most a year at a time.");

/** One student's marks today, and their morning boarding over the last 30 days. */
export async function studentJourney(db: Tx, schoolId: string, studentId: string): Promise<StudentJourney> {
  const student = await db.student.findFirst({
    where: { id: studentId, schoolId, deletedAt: null },
    select: { roll: true, busId: true, stop: { select: { name: true } } },
  });
  if (!student) throw notFound("Student");

  const today = localDate();
  const from = addDays(today, -29);
  const [todayMarks, recent, busTrips] = await inParallel(db, [
    () =>
      db.attendanceMark.findMany({
        where: { studentId, undone: false, trip: { schoolId, date: dbDate(today) } },
        include: { trip: { select: { phase: true, bus: { select: { number: true } } } } },
        orderBy: { markedAt: "asc" },
      }),
    () =>
      db.attendanceMark.findMany({
        where: { studentId, undone: false, phase: "BOARD", trip: { schoolId, phase: "MORNING", date: { gte: dbDate(from), lte: dbDate(today) } } },
        select: { tripId: true, status: true },
      }),
    () =>
      student.busId
        ? db.trip.findMany({
            where: { schoolId, busId: student.busId, phase: "MORNING", status: "COMPLETED", date: { gte: dbDate(from), lte: dbDate(today) } },
            select: { id: true },
          })
        : Promise.resolve([]),
  ] as const);

  const crewIds = [...new Set(todayMarks.map((m) => m.markedById))];
  const crew = crewIds.length
    ? await db.crew.findMany({ where: { schoolId, id: { in: crewIds } }, select: { id: true, name: true } })
    : [];
  const crewName = new Map(crew.map((c) => [c.id, c.name]));
  const stop = student.stop?.name ?? "their stop";

  const events = todayMarks.map((m) => {
    const evening = m.trip.phase === "EVENING";
    const title =
      m.status === "ABSENT"
        ? `Marked absent${evening ? " for the return trip" : ""}`
        : m.phase === "BOARD"
          ? evening ? "Boarded return bus at school" : `Boarded bus at ${stop}`
          : evening ? `Dropped at ${stop}` : "Dropped at school";
    return {
      id: m.id,
      time: formatTime(m.markedAt),
      title,
      by: `Marked by ${crewName.get(m.markedById) ?? "crew"} · Bus ${m.trip.bus.number}`,
      absent: m.status === "ABSENT",
    };
  });

  const marked = new Set(recent.map((m) => m.tripId));
  return {
    roll: student.roll,
    today,
    events,
    last30: {
      boarded: recent.filter((m) => m.status === "BOARDED").length,
      absent: recent.filter((m) => m.status === "ABSENT").length,
      unmarked: busTrips.filter((t) => !marked.has(t.id)).length,
    },
  };
}
