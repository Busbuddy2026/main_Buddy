import "server-only";
import { z } from "zod";
import { inParallel, type Tx } from "@/server/db";
import type { Ctx } from "@/server/http/handler";
import { conflict, invalid, notFound } from "@/server/http/errors";
import { addDays, clockLabel, dayOf, dbDate, formatTime, formatWeekday, localDate } from "@/lib/time";
import { readSettings } from "@/lib/api/schemas/settings";
import { phoneLabel } from "@/server/services/masters/view";
import type { ToneKind } from "@/lib/transport/tone";

/**
 * Everything the parent app reads, always through the guardian's own link to
 * the child (StudentGuardian). A child id the guardian is not linked to reads
 * as "not found", the same as one that does not exist.
 */

export type JourneyState = "done" | "now" | "todo";

export interface ChildToday {
  date: string;
  dayLabel: string;
  phase: "morning" | "evening";
  status: { label: string; kind: ToneKind };
  bus: string | null;
  route: string | null;
  stop: string | null;
  /** "7:24 AM", the scheduled pickup (morning) or drop (evening). */
  scheduled: string | null;
  journey: Array<{ title: string; time: string; state: JourneyState }>;
  absence: { phase: "am" | "pm" | "both"; reason: string | null } | null;
}

export interface HistoryDayView {
  date: string;
  label: string;
  status: string;
  kind: ToneKind;
  rows: Array<{ time: string; label: string }>;
}

export interface NotificationView {
  id: string;
  type: "attendance" | "transport" | "alert";
  title: string;
  body: string;
  time: string;
  unread: boolean;
}

export async function ownChild(db: Tx, guardianId: string, schoolId: string, studentId: string) {
  const link = await db.studentGuardian.findFirst({
    where: { guardianId, studentId, student: { schoolId, deletedAt: null } },
    include: { student: { include: { bus: true, stop: true, route: true } } },
  });
  if (!link) throw notFound("Child");
  return link.student;
}

/** Which trip a parent cares about right now. */
function currentPhase(now: Date, eveningStart: string, tz: string): "morning" | "evening" {
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  // From noon the morning run is history; the evening run is what matters.
  return hhmm >= (eveningStart < "12:00" ? eveningStart : "12:00") ? "evening" : "morning";
}

export async function childToday(db: Tx, ctx: Pick<Ctx, "schoolId"> & { guardianId: string }, studentId: string): Promise<ChildToday> {
  const child = await ownChild(db, ctx.guardianId, ctx.schoolId, studentId);
  const school = await db.school.findUniqueOrThrow({ where: { id: ctx.schoolId } });
  const settings = readSettings(school.settings);
  const tz = school.timezone;
  const today = localDate(new Date(), tz);
  const phase = currentPhase(new Date(), settings.evening.start, tz);
  const first = child.name.split(" ")[0] ?? child.name;
  const weekday = dbDate(today).getUTCDay();

  const [trip, absence, routeStops] = await inParallel(db, [
    () =>
      child.busId
        ? db.trip.findUnique({
            where: { busId_date_phase: { busId: child.busId, date: dbDate(today), phase: phase === "morning" ? "MORNING" : "EVENING" } },
            include: { marks: { where: { studentId: child.id, undone: false } } },
          })
        : Promise.resolve(null),
    () =>
      db.absenceRequest.findFirst({
        where: { studentId: child.id, date: dbDate(today), cancelledAt: null, phase: { in: phase === "morning" ? ["am", "both"] : ["pm", "both"] } },
      }),
    () =>
      child.routeId
        ? db.routeStop.findMany({ where: { routeId: child.routeId }, orderBy: { sequence: "asc" }, include: { stop: true } })
        : Promise.resolve([]),
  ] as const);

  const own = routeStops.find((r) => r.stopId === child.stopId);
  const schoolStop = routeStops[routeStops.length - 1];
  const scheduled = own ? clockLabel(phase === "morning" ? own.pickupTime : own.dropTime) : null;
  const board = trip?.marks.find((m) => m.phase === "BOARD");
  const drop = trip?.marks.find((m) => m.phase === "DROP");
  const t = (d: Date | null | undefined) => (d ? formatTime(d, tz) : "—");

  let status: ChildToday["status"];
  let journey: ChildToday["journey"];

  if (weekday === 0 || weekday === 6) {
    status = { label: "No school today", kind: "offline" };
    journey = [];
  } else if (absence && !board) {
    status = { label: "Not travelling today", kind: "offline" };
    journey = [{ title: `You told the school ${first} is not using the bus`, time: t(absence.createdAt), state: "done" }];
  } else if (board?.status === "ABSENT") {
    status = { label: "Marked absent", kind: "bad" };
    journey = [
      { title: "Bus started", time: t(trip?.startedAt), state: "done" },
      { title: `${first} was marked absent at the stop`, time: t(board.markedAt), state: "done" },
    ];
  } else if (phase === "morning") {
    const started = !!trip?.startedAt;
    status = drop
      ? { label: "Reached school", kind: "good" }
      : board
        ? { label: "On the way to school", kind: "ontime" }
        : started
          ? { label: "Bus is on its way", kind: "ontime" }
          : { label: "Waiting for the bus", kind: "offline" };
    journey = [
      { title: "Bus started from depot", time: t(trip?.startedAt), state: started ? "done" : "todo" },
      { title: `${first} boarded the bus`, time: board ? t(board.markedAt) : (scheduled ?? "—"), state: board ? "done" : started ? "now" : "todo" },
      { title: "On the way to school", time: board && !drop ? "Now" : "—", state: drop ? "done" : board ? "now" : "todo" },
      { title: "Reached school", time: drop ? t(drop.markedAt) : schoolStop ? clockLabel(schoolStop.pickupTime) : "—", state: drop ? "done" : "todo" },
    ];
  } else {
    status = drop
      ? { label: "Dropped home", kind: "good" }
      : board
        ? { label: "On the way home", kind: "ontime" }
        : { label: "At school", kind: "offline" };
    journey = [
      { title: "Return trip scheduled", time: schoolStop ? clockLabel(schoolStop.dropTime) : "—", state: board || trip?.startedAt ? "done" : "now" },
      { title: `${first} boarded at school`, time: t(board?.markedAt), state: board ? "done" : "todo" },
      { title: `Dropped at ${child.stop?.name ?? "the stop"}`, time: drop ? t(drop.markedAt) : (scheduled ?? "—"), state: drop ? "done" : board ? "now" : "todo" },
    ];
  }

  return {
    date: today,
    dayLabel: formatWeekday(today),
    phase,
    status,
    bus: child.bus && !child.bus.deletedAt ? `Bus ${child.bus.number}` : null,
    route: child.route?.name ?? null,
    stop: child.stop?.name ?? null,
    scheduled,
    journey,
    absence: absence ? { phase: absence.phase as "am" | "pm" | "both", reason: absence.reason } : null,
  };
}

export async function childHistory(db: Tx, guardianId: string, schoolId: string, studentId: string, days = 14): Promise<HistoryDayView[]> {
  const child = await ownChild(db, guardianId, schoolId, studentId);
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { timezone: true } });
  const today = localDate(new Date(), school.timezone);
  const from = addDays(today, -(days - 1));
  const [marks, absences, stops] = await inParallel(db, [
    () =>
      db.attendanceMark.findMany({
        where: { studentId: child.id, undone: false, trip: { date: { gte: dbDate(from), lte: dbDate(today) } } },
        include: { trip: { select: { date: true, phase: true } } },
        orderBy: { markedAt: "asc" },
      }),
    () => db.absenceRequest.findMany({ where: { studentId: child.id, cancelledAt: null, date: { gte: dbDate(from), lte: dbDate(today) } } }),
    () => db.stop.findMany({ where: { schoolId }, select: { id: true, name: true } }),
  ] as const);
  const stopName = new Map(stops.map((s) => [s.id, s.name]));

  const byDay = new Map<string, HistoryDayView>();
  for (const m of marks) {
    const d = dayOf(m.trip.date);
    const row = byDay.get(d) ?? { date: d, label: "", status: "", kind: "good" as ToneKind, rows: [] };
    const where = m.stopId ? stopName.get(m.stopId) : null;
    const label =
      m.status === "ABSENT"
        ? "Marked absent by attendant"
        : m.phase === "BOARD"
          ? m.trip.phase === "MORNING" ? `Boarded bus${where ? ` at ${where}` : ""}` : "Boarded return bus"
          : m.trip.phase === "MORNING" ? "Reached school" : `Dropped safely${where ? ` at ${where}` : ""}`;
    row.rows.push({ time: formatTime(m.markedAt, school.timezone), label });
    byDay.set(d, row);
  }
  for (const a of absences) {
    const d = dayOf(a.date);
    const row = byDay.get(d) ?? { date: d, label: "", status: "", kind: "offline" as ToneKind, rows: [] };
    row.rows.unshift({ time: "—", label: `Transport not used (${a.phase === "both" ? "both trips" : a.phase === "am" ? "morning" : "evening"})${a.reason ? ` · ${a.reason}` : ""}` });
    byDay.set(d, row);
  }

  return [...byDay.values()]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((d) => {
      const absent = d.rows.some((r) => r.label.startsWith("Marked absent") || r.label.startsWith("Transport not used"));
      const dropped = d.rows.some((r) => r.label.startsWith("Dropped safely"));
      return {
        ...d,
        label: d.date === today ? `Today · ${formatWeekday(d.date).split(" · ")[1]}` : formatWeekday(d.date),
        status: absent && !d.rows.some((r) => r.label.startsWith("Boarded")) ? "Absent" : d.date === today && !dropped ? "In progress" : "Completed",
        kind: absent && !d.rows.some((r) => r.label.startsWith("Boarded")) ? "bad" : d.date === today && !dropped ? "ontime" : "good",
      };
    });
}

// ── Notifications ─────────────────────────────────────────────────────────

export async function listNotifications(db: Tx, guardianId: string, schoolId: string): Promise<{ items: NotificationView[]; unread: number }> {
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { timezone: true } });
  const today = localDate(new Date(), school.timezone);
  const rows = await db.notification.findMany({
    where: { schoolId, guardianId, audience: "GUARDIAN" },
    orderBy: { sentAt: "desc" },
    take: 100,
  });
  return {
    unread: rows.filter((r) => !r.readAt).length,
    items: rows.map((r) => {
      const day = localDate(r.sentAt, school.timezone);
      return {
        id: r.id,
        type: (["attendance", "transport", "alert"].includes(r.type) ? r.type : "alert") as NotificationView["type"],
        title: r.title,
        body: r.body,
        time: day === today ? formatTime(r.sentAt, school.timezone) : day === addDays(today, -1) ? "Yesterday" : formatWeekday(day).split(" · ")[1]!,
        unread: !r.readAt,
      };
    }),
  };
}

export async function markNotificationsRead(ctx: Ctx) {
  const { count } = await ctx.db.notification.updateMany({
    where: { schoolId: ctx.schoolId, guardianId: ctx.actor.id, readAt: null },
    data: { readAt: new Date() },
  });
  ctx.audit({ action: "READ_NOTIFICATIONS", entityType: "Guardian", entityId: ctx.actor.id, meta: { count } });
}

// ── Absences ──────────────────────────────────────────────────────────────

export const absenceSchema = z
  .object({
    date: z.iso.date(),
    morning: z.boolean(),
    evening: z.boolean(),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.morning || v.evening, "Choose at least one trip.");

/**
 * Report that a child will not use the bus. Replaces any notice for the same
 * day. Refused for a trip that has already started — by then the attendant
 * is marking, and a call to the office is the right channel.
 */
export async function reportAbsence(ctx: Ctx, studentId: string, input: z.infer<typeof absenceSchema>) {
  const { db, schoolId } = ctx;
  const child = await ownChild(db, ctx.actor.id, schoolId, studentId);
  const today = localDate();
  if (input.date < today) throw invalid("That day has passed.", { date: "Pick today or a later day." });
  if (input.date > addDays(today, 60)) throw invalid("Report absences up to two months ahead.", { date: "Pick a nearer day." });

  if (input.date === today && child.busId) {
    const started = await db.trip.findMany({
      where: { busId: child.busId, date: dbDate(today), status: { in: ["ACTIVE", "COMPLETED"] } },
      select: { phase: true },
    });
    const blocked = started
      .map((t) => (t.phase === "MORNING" ? "morning" : "evening"))
      .filter((p) => (p === "morning" ? input.morning : input.evening));
    if (blocked.length) {
      throw conflict(`The ${blocked[0]} trip has already started. Call the transport office instead.`);
    }
  }

  const phase = input.morning && input.evening ? "both" : input.morning ? "am" : "pm";
  // One live notice per child per day; a new one replaces the old.
  await db.absenceRequest.updateMany({
    where: { studentId: child.id, date: dbDate(input.date), cancelledAt: null },
    data: { cancelledAt: new Date() },
  });
  const row = await db.absenceRequest.upsert({
    where: { studentId_date_phase: { studentId: child.id, date: dbDate(input.date), phase } },
    create: { schoolId, studentId: child.id, guardianId: ctx.actor.id, date: dbDate(input.date), phase, reason: input.reason || null },
    update: { cancelledAt: null, acknowledgedAt: null, guardianId: ctx.actor.id, reason: input.reason || null, createdAt: new Date() },
  });
  ctx.audit({ action: "REPORT_ABSENCE", entityType: "AbsenceRequest", entityId: row.id, meta: { studentId: child.id, date: input.date, phase } });
  return row.id;
}

export async function cancelAbsence(ctx: Ctx, absenceId: string) {
  const { db, schoolId } = ctx;
  const row = await db.absenceRequest.findFirst({ where: { id: absenceId, schoolId, cancelledAt: null } });
  if (!row) throw notFound("Absence");
  await ownChild(db, ctx.actor.id, schoolId, row.studentId);
  await db.absenceRequest.update({ where: { id: row.id }, data: { cancelledAt: new Date() } });
  ctx.audit({ action: "CANCEL_ABSENCE", entityType: "AbsenceRequest", entityId: row.id });
}

export async function upcomingAbsences(db: Tx, guardianId: string, schoolId: string, studentId: string) {
  const child = await ownChild(db, guardianId, schoolId, studentId);
  const rows = await db.absenceRequest.findMany({
    where: { studentId: child.id, cancelledAt: null, date: { gte: dbDate(localDate()) } },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    date: dayOf(r.date),
    label: formatWeekday(dayOf(r.date)),
    phase: r.phase as "am" | "pm" | "both",
    reason: r.reason,
  }));
}

// ── Contacts ──────────────────────────────────────────────────────────────

export async function contacts(db: Tx, guardianId: string, schoolId: string, studentId: string) {
  const child = await ownChild(db, guardianId, schoolId, studentId);
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
  const bus = child.busId
    ? await db.bus.findUnique({ where: { id: child.busId }, include: { driver: true, attendant: true } })
    : null;
  const list = [{ name: "School transport office", role: school.name, icon: "school", phone: school.phone ?? "" }];
  if (bus?.attendant) list.push({ name: bus.attendant.name, role: `Attendant · Bus ${bus.number}`, icon: "badge", phone: phoneLabel(bus.attendant.phone) });
  if (bus?.driver) list.push({ name: bus.driver.name, role: `Driver · Bus ${bus.number}`, icon: "directions_bus", phone: phoneLabel(bus.driver.phone) });
  return list.filter((c) => c.phone);
}
