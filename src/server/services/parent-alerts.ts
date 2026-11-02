import "server-only";
import { db, type Tx } from "@/server/db";
import { readSettings } from "@/lib/api/schemas/settings";
import { addDays, clockLabel, dbDate, formatTime, localDate } from "@/lib/time";
import { localMinute, localWeekday, median } from "@/lib/fleet-metrics";
import { gpsRun } from "@/server/services/gps-run";
import { typicalStopTimes } from "@/server/services/fleet-analytics";
import { notifyGuardians } from "@/server/services/notify";

/**
 * Parent alerts from the bus's GPS, sent after each fleet sync:
 * - "Boarding and drop alerts" (pref `alerts`): the bus reached the child's
 *   stop, and in the morning, reached school.
 * - "Delay and route changes" (pref `absence`): the bus has not reached a
 *   stop by its usual time plus the school's delay limit, or it left its route.
 * Each alert goes once per stop per run, remembered in the tracker's
 * `alarmState`. Only fresh events alert, so a late first sync does not replay
 * the whole morning.
 */

const RECENT_MS = 30 * 60_000;
const SCHOOL_RECENT_MS = 60 * 60_000;
const WATCH_EVERY_MS = 60_000;
const lastWatch = new Map<string, number>();

const clockMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const first = (name: string) => name.split(" ")[0] ?? name;

export async function watchRuns(schoolId: string): Promise<void> {
  if (Date.now() - (lastWatch.get(schoolId) ?? 0) < WATCH_EVERY_MS) return;
  lastWatch.set(schoolId, Date.now());

  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { settings: true, timezone: true } });
  const settings = readSettings(school.settings);
  const tz = school.timezone;
  const now = new Date();
  const minute = localMinute(now.toISOString(), tz);
  // Only around the school runs, an hour either side.
  const window = [
    { phase: "morning" as const, w: settings.morning },
    { phase: "evening" as const, w: settings.evening },
  ].find(({ w }) => minute >= clockMin(w.start) - 60 && minute <= clockMin(w.end) + 90);
  if (!window || localWeekday(now.toISOString(), tz) === 0) return;
  const { phase } = window;
  const today = localDate(now, tz);

  const devices = await db.gpsDevice.findMany({
    where: { schoolId, busId: { not: null }, externalVehicleId: { not: null } },
    select: { id: true, busId: true, alarmState: true },
  });
  for (const device of devices) {
    await watchBus(db, schoolId, device, { phase, today, tz, minute, delayMin: settings.delayThresholdMin }).catch(() => undefined);
  }
}

async function watchBus(
  client: Tx,
  schoolId: string,
  device: { id: string; busId: string | null; alarmState: unknown },
  o: { phase: "morning" | "evening"; today: string; tz: string; minute: number; delayMin: number },
) {
  const busId = device.busId!;
  const run = await gpsRun(client, schoolId, busId, o.today, o.tz, o.phase);
  if (!run?.trip) return;
  const bus = await client.bus.findUniqueOrThrow({ where: { id: busId }, select: { number: true, routeId: true } });
  const riders = await client.student.findMany({ where: { busId, deletedAt: null }, select: { id: true, name: true, stopId: true } });
  if (!riders.length) return;
  const away = new Set(
    (
      await client.absenceRequest.findMany({
        where: { schoolId, date: dbDate(o.today), cancelledAt: null, studentId: { in: riders.map((r) => r.id) }, phase: { in: o.phase === "morning" ? ["am", "both"] : ["pm", "both"] } },
        select: { studentId: true },
      })
    ).map((a) => a.studentId),
  );
  const travelling = riders.filter((r) => !away.has(r.id));

  // What this run has already told parents.
  const all = { ...((device.alarmState as Record<string, string>) ?? {}) };
  const key = `told:${o.today}:${o.phase}`;
  const told = new Set((all[key] ?? "").split(",").filter(Boolean));
  const before = told.size;
  const stopNames = new Map(
    (await client.stop.findMany({ where: { id: { in: [...run.pinned] } }, select: { id: true, name: true } })).map((s) => [s.id, s.name]),
  );

  // The bus reached a stop.
  for (const [stopId, visit] of run.visits) {
    if (!visit.at || told.has(`at:${stopId}`) || Date.now() - Date.parse(visit.at) > RECENT_MS) continue;
    const kids = travelling.filter((r) => r.stopId === stopId);
    if (!kids.length) continue;
    told.add(`at:${stopId}`);
    const name = stopNames.get(stopId) ?? "your stop";
    const time = formatTime(new Date(visit.at), o.tz);
    for (const kid of kids) {
      await notifyGuardians(client, schoolId, kid.id, "alerts", {
        type: "transport",
        title: `Bus reached ${name}`,
        body: o.phase === "morning"
          ? `Bus ${bus.number} reached ${name} at ${time} to pick up ${first(kid.name)}.`
          : `Bus ${bus.number} reached ${name} at ${time} with ${first(kid.name)}.`,
      });
    }
  }

  // The morning run reached school.
  const end = run.trip.end;
  if (o.phase === "morning" && !run.trip.running && end && !told.has("school") && Date.now() - Date.parse(end) <= SCHOOL_RECENT_MS) {
    told.add("school");
    const time = formatTime(new Date(end), o.tz);
    for (const kid of travelling) {
      await notifyGuardians(client, schoolId, kid.id, "alerts", {
        type: "transport",
        title: "Bus reached school",
        body: `Bus ${bus.number} reached school at ${time}.`,
      });
    }
  }

  // Running late: a pinned stop with children, not reached yet, past its usual time plus the limit.
  if (run.trip.running) {
    const usual = await typicalStopTimes(client, [busId], o.tz);
    const planned = bus.routeId ? await client.routeStop.findMany({ where: { routeId: bus.routeId }, select: { stopId: true, pickupTime: true, dropTime: true } }) : [];
    for (const stopId of run.pinned) {
      if (run.visits.get(stopId)?.at || told.has(`late:${stopId}`)) continue;
      const kids = travelling.filter((r) => r.stopId === stopId);
      if (!kids.length) continue;
      const plan = planned.find((p) => p.stopId === stopId);
      const expected = (o.phase === "morning" ? usual.get(stopId)?.morning : usual.get(stopId)?.evening) ?? (o.phase === "morning" ? plan?.pickupTime : plan?.dropTime);
      if (!expected) continue;
      const late = o.minute - clockMin(expected);
      if (late < o.delayMin) continue;
      told.add(`late:${stopId}`);
      const name = stopNames.get(stopId) ?? "your stop";
      for (const kid of kids) {
        await notifyGuardians(client, schoolId, kid.id, "absence", {
          type: "alert",
          title: "Bus running late",
          body: `Bus ${bus.number} usually reaches ${name} around ${clockLabel(expected)}. It is about ${late} min late.`,
        });
      }
    }
  }

  if (told.size !== before) {
    // Keep only today's memory.
    for (const k of Object.keys(all)) if (k.startsWith("told:") && !k.startsWith(`told:${o.today}`)) delete all[k];
    all[key] = [...told].join(",");
    await client.gpsDevice.update({ where: { id: device.id }, data: { alarmState: all } });
  }
}

/** The bus left its route (raised once per run by the tracking rules). */
export async function notifyRouteChange(client: Tx, schoolId: string, busId: string): Promise<void> {
  const bus = await client.bus.findUniqueOrThrow({ where: { id: busId }, select: { number: true } });
  const riders = await client.student.findMany({ where: { busId, deletedAt: null }, select: { id: true } });
  for (const r of riders) {
    await notifyGuardians(client, schoolId, r.id, "absence", {
      type: "alert",
      title: "Bus taking a different road",
      body: `Bus ${bus.number} is more than 500 m from its usual route. The transport office has been alerted.`,
    });
  }
}

// ── Weekly summary ────────────────────────────────────────────────────────

/**
 * Friday evening: for each child whose parent asked for it (pref `digest`),
 * the week's pickups at their stop, school arrivals and reported absences,
 * from the bus's saved days.
 */
export async function weeklyDigest(schoolId: string): Promise<{ sent: number }> {
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { timezone: true, settings: true } });
  const tz = school.timezone;
  const bell = readSettings(school.settings).bellTime;
  const today = localDate(new Date(), tz);
  const from = addDays(today, -6);
  const students = await db.student.findMany({
    where: { schoolId, deletedAt: null, busId: { not: null }, guardians: { some: { guardian: { deletedAt: null } } } },
    select: { id: true, name: true, busId: true, stopId: true, stop: { select: { name: true } } },
  });
  const busIds = [...new Set(students.map((s) => s.busId!))];
  const [days, absences] = await Promise.all([
    db.busDay.findMany({ where: { busId: { in: busIds }, date: { gte: dbDate(from), lte: dbDate(today) } }, select: { busId: true, stopVisits: true, schoolArrivalAt: true } }),
    db.absenceRequest.findMany({ where: { schoolId, cancelledAt: null, date: { gte: dbDate(from), lte: dbDate(today) } }, select: { studentId: true } }),
  ]);

  let sent = 0;
  for (const s of students) {
    const mine = days.filter((d) => d.busId === s.busId);
    const pickups = mine
      .flatMap((d) => (d.stopVisits as unknown as Array<{ stopId: string; at: string | null }>).filter((v) => v.stopId === s.stopId && v.at))
      .map((v) => localMinute(v.at!, tz))
      .filter((m) => m < 12 * 60);
    const arrivals = mine.filter((d) => d.schoolArrivalAt).map((d) => localMinute(d.schoolArrivalAt!.toISOString(), tz)).filter((m) => m < 12 * 60);
    const off = absences.filter((a) => a.studentId === s.id).length;
    if (!pickups.length && !arrivals.length && !off) continue;

    const clock = (m: number) => clockLabel(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`);
    const parts: string[] = [];
    if (pickups.length) parts.push(`The bus reached ${s.stop?.name ?? "your stop"} on ${pickups.length} ${pickups.length === 1 ? "day" : "days"}, usually around ${clock(median(pickups)!)}.`);
    if (arrivals.length) {
      const onTime = arrivals.filter((m) => m <= clockMin(bell)).length;
      parts.push(`It reached school by ${clockLabel(bell)} on ${onTime} of ${arrivals.length} ${arrivals.length === 1 ? "day" : "days"}.`);
    }
    if (off) parts.push(`You reported ${off} transport ${off === 1 ? "absence" : "absences"}.`);
    sent += await notifyGuardians(db, schoolId, s.id, "digest", { type: "transport", title: `${first(s.name)}'s week on the bus`, body: parts.join(" ") });
  }
  return { sent };
}
