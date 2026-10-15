import "server-only";
import { inParallel, type Tx } from "@/server/db";
import { addDays, dayOf, dbDate, formatDay, formatTime, localDate } from "@/lib/time";
import { readSettings } from "@/lib/api/schemas/settings";

/**
 * Transport analytics, computed on read from trips, marks, incidents and
 * assignments. A school's volume (a few hundred trips a month) keeps this
 * well within a single request; roll-up tables come when a school outgrows it.
 */

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

export async function overview(db: Tx, schoolId: string, days = 30) {
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
  const settings = readSettings(school.settings);
  const today = localDate(new Date(), school.timezone);
  const from = addDays(today, -(days - 1));
  const prevFrom = addDays(from, -days);

  const [trips, prevTrips, incidents, routes, buses] = await inParallel(db, [
    () =>
      db.trip.findMany({
        where: { schoolId, status: "COMPLETED", date: { gte: dbDate(from), lte: dbDate(today) } },
        select: { date: true, delayMin: true, phase: true, marks: { where: { undone: false, phase: "BOARD" }, select: { status: true } } },
      }),
    () =>
      db.trip.findMany({
        where: { schoolId, status: "COMPLETED", date: { gte: dbDate(prevFrom), lt: dbDate(from) } },
        select: { delayMin: true },
      }),
    () => db.incident.findMany({ where: { schoolId, occurredAt: { gte: dbDate(from) } }, select: { type: true } }),
    () =>
      db.route.findMany({
        where: { schoolId, deletedAt: null },
        select: { name: true, _count: { select: { students: { where: { deletedAt: null } } } } },
      }),
    () =>
      db.bus.findMany({
        where: { schoolId, deletedAt: null, status: { not: "MAINTENANCE" } },
        select: { capacity: true, _count: { select: { students: { where: { deletedAt: null } } } } },
      }),
  ] as const);

  const onTime = (t: { delayMin: number }) => t.delayMin <= settings.delayThresholdMin;
  const rate = pct(trips.filter(onTime).length, trips.length);
  const prevRate = pct(prevTrips.filter(onTime).length, prevTrips.length);
  const avgDelay = trips.length ? trips.reduce((n, t) => n + t.delayMin, 0) / trips.length : 0;
  const prevDelay = prevTrips.length ? prevTrips.reduce((n, t) => n + t.delayMin, 0) / prevTrips.length : 0;
  const seats = buses.reduce((n, b) => n + b.capacity, 0);
  const riders = buses.reduce((n, b) => n + b._count.students, 0);
  const tripDelta = prevTrips.length ? ((trips.length - prevTrips.length) / prevTrips.length) * 100 : null;

  // On-time rate per school day, the last 14 days that ran.
  const byDay = new Map<string, { all: number; ok: number }>();
  for (const t of trips) {
    const d = dayOf(t.date);
    const v = byDay.get(d) ?? { all: 0, ok: 0 };
    v.all += 1;
    if (onTime(t)) v.ok += 1;
    byDay.set(d, v);
  }
  const series = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-14)
    .map(([d, v]) => ({ day: d, label: d.slice(8), value: pct(v.ok, v.all) }));

  const morningMarks = trips.filter((t) => t.phase === "MORNING").flatMap((t) => t.marks);
  const boarded = morningMarks.filter((m) => m.status === "BOARDED").length;
  const absent = morningMarks.filter((m) => m.status === "ABSENT").length;

  const byType = (match: RegExp) => incidents.filter((i) => match.test(i.type)).length;
  const busiest = [...routes].sort((a, b) => b._count.students - a._count.students).slice(0, 3);
  const top = busiest[0]?._count.students || 1;

  return {
    days,
    kpis: {
      trips: trips.length,
      tripDelta,
      onTimeRate: rate,
      onTimeDelta: prevTrips.length ? Math.round((rate - prevRate) * 10) / 10 : null,
      avgDelay: Math.round(avgDelay * 10) / 10,
      delayDelta: prevTrips.length ? Math.round((avgDelay - prevDelay) * 10) / 10 : null,
      utilisation: Math.round(pct(riders, seats)),
    },
    threshold: settings.delayThresholdMin,
    series,
    attendance: {
      boardingRate: pct(boarded, boarded + absent),
      absenceRate: pct(absent, boarded + absent),
      marks: boarded + absent,
    },
    safety: [
      ["Harsh braking", byType(/braking/i)],
      ["Route deviations", byType(/deviation/i)],
      ["SOS alerts", byType(/^SOS$/)],
      ["Camera faults", byType(/camera/i)],
      ["All incidents", incidents.length],
    ] as Array<[string, number]>,
    busiest: busiest.map((r) => ({
      route: r.name,
      count: r._count.students,
      width: `${Math.round((r._count.students / top) * 100)}%`,
    })),
  };
}

/** Per-driver figures for the driver-performance cards. */
export async function driverStats(db: Tx, schoolId: string, days = 30) {
  const from = dbDate(addDays(localDate(), -(days - 1)));
  const [trips, incidents, buses] = await inParallel(db, [
    () =>
      db.trip.findMany({
        where: { schoolId, status: "COMPLETED", date: { gte: from }, driverId: { not: null } },
        select: { driverId: true, delayMin: true },
      }),
    () => db.incident.findMany({ where: { schoolId, occurredAt: { gte: from }, busId: { not: null } }, select: { busId: true, type: true } }),
    () => db.bus.findMany({ where: { schoolId, driverId: { not: null } }, select: { id: true, driverId: true } }),
  ] as const);
  const busOf = new Map(buses.map((b) => [b.driverId!, b.id]));
  const out: Record<string, { trips: number; late: number; braking: number; incidents: number }> = {};
  for (const t of trips) {
    const v = (out[t.driverId!] ??= { trips: 0, late: 0, braking: 0, incidents: 0 });
    v.trips += 1;
    if (t.delayMin > 5) v.late += 1;
  }
  for (const [driverId, busId] of busOf) {
    const v = (out[driverId] ??= { trips: 0, late: 0, braking: 0, incidents: 0 });
    const own = incidents.filter((i) => i.busId === busId);
    v.incidents = own.length;
    v.braking = own.filter((i) => /braking/i.test(i.type)).length;
  }
  return out;
}

// ── CSV reports ───────────────────────────────────────────────────────────

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: Array<Array<string | number>>) => rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";

export async function tripsCsv(db: Tx, schoolId: string, from: string, to: string) {
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { timezone: true } });
  const trips = await db.trip.findMany({
    where: { schoolId, date: { gte: dbDate(from), lte: dbDate(to) } },
    include: {
      bus: { select: { number: true } },
      route: { select: { name: true } },
      marks: { where: { undone: false }, select: { phase: true, status: true } },
    },
    orderBy: [{ date: "asc" }, { phase: "asc" }],
  });
  const crew = new Map(
    (await db.crew.findMany({ where: { schoolId }, select: { id: true, name: true } })).map((c) => [c.id, c.name]),
  );
  return csv([
    ["Date", "Trip", "Bus", "Route", "Driver", "Attendant", "Status", "Started", "Completed", "Delay (min)", "Boarded", "Absent", "Dropped"],
    ...trips.map((t) => [
      dayOf(t.date),
      t.phase === "MORNING" ? "Morning" : "Evening",
      `Bus ${t.bus.number}`,
      t.route.name,
      t.driverId ? (crew.get(t.driverId) ?? "") : "",
      t.attendantId ? (crew.get(t.attendantId) ?? "") : "",
      t.status,
      t.startedAt ? formatTime(t.startedAt, school.timezone) : "",
      t.completedAt ? formatTime(t.completedAt, school.timezone) : "",
      t.delayMin,
      t.marks.filter((m) => m.phase === "BOARD" && m.status === "BOARDED").length,
      t.marks.filter((m) => m.status === "ABSENT").length,
      t.marks.filter((m) => m.phase === "DROP").length,
    ]),
  ]);
}

export async function incidentsCsv(db: Tx, schoolId: string, from: string, to: string) {
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { timezone: true } });
  const rows = await db.incident.findMany({
    where: { schoolId, occurredAt: { gte: dbDate(from), lt: dbDate(addDays(to, 1)) } },
    orderBy: { occurredAt: "asc" },
  });
  const buses = new Map((await db.bus.findMany({ where: { schoolId }, select: { id: true, number: true } })).map((b) => [b.id, b.number]));
  return csv([
    ["Code", "Date", "Time", "Bus", "Type", "Severity", "Status", "Assigned to", "Resolved", "Description"],
    ...rows.map((r) => [
      r.code ?? "",
      formatDay(r.occurredAt, school.timezone),
      formatTime(r.occurredAt, school.timezone),
      r.busId ? `Bus ${buses.get(r.busId) ?? ""}` : "",
      r.type,
      r.severity,
      r.status,
      r.assignedTo ?? "",
      r.resolvedAt ? formatDay(r.resolvedAt, school.timezone) : "",
      r.description,
    ]),
  ]);
}
