import "server-only";
import { z } from "zod";
import type { Tx } from "@/server/db";
import type { Ctx } from "@/server/http/handler";
import { conflict, invalid, notFound } from "@/server/http/errors";
import { notifyGuardians } from "@/server/services/notify";
import { formatDay, formatTime } from "@/lib/time";
import type { SchoolTripStatus } from "@/generated/prisma/client";

/**
 * School trips beyond their configuration (which saves through the masters
 * API): the student manifest, parent consent, and the day's status workflow.
 * Status changes are read back from the audit log to build the trip timeline,
 * so nothing is stored twice.
 */

const FLOW: SchoolTripStatus[] = ["DRAFT", "SCHEDULED", "ON_THE_WAY", "AT_VENUE", "RETURNING", "COMPLETED"];

const STEP_TITLE: Record<SchoolTripStatus, string> = {
  DRAFT: "Trip drafted",
  SCHEDULED: "Trip scheduled",
  ON_THE_WAY: "Departed school campus",
  AT_VENUE: "Reached the venue",
  RETURNING: "Return headcount and boarding",
  COMPLETED: "Back at school campus",
  CANCELLED: "Trip cancelled",
};

async function ownTrip(db: Tx, schoolId: string, id: string) {
  const trip = await db.schoolTrip.findFirst({ where: { id, schoolId, deletedAt: null }, include: { fleet: true, manifest: true } });
  if (!trip) throw notFound("School trip");
  return trip;
}

export async function manifest(db: Tx, schoolId: string, id: string) {
  const trip = await ownTrip(db, schoolId, id);
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { timezone: true } });
  const [students, buses, history] = await Promise.all([
    db.student.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
      select: { id: true, name: true, grade: true, section: true },
    }),
    db.bus.findMany({ where: { id: { in: trip.fleet.map((f) => f.busId) } }, select: { id: true, number: true } }),
    db.auditLog.findMany({
      where: { schoolId, entityType: "SchoolTrip", entityId: id, action: { in: ["SCHOOL_TRIP_STATUS", "CREATE_SCHOOL_TRIP"] } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const busOf = new Map(trip.fleet.map((f) => [f.id, buses.find((b) => b.id === f.busId)?.number ?? ""]));
  const on = new Map(trip.manifest.map((m) => [m.studentId, m]));

  // The timeline: every step of the flow, done when the audit log says so.
  const reached = new Map<string, Date>();
  for (const h of history) {
    const to = (h.meta as { to?: SchoolTripStatus } | null)?.to;
    if (to) reached.set(to, h.createdAt);
  }
  const flow = trip.status === "CANCELLED" ? [...FLOW.slice(0, 2), "CANCELLED" as const] : FLOW.slice(1);
  const index = flow.indexOf(trip.status);

  return {
    status: trip.status,
    next: trip.status === "CANCELLED" || trip.status === "COMPLETED" ? null : FLOW[FLOW.indexOf(trip.status) + 1] ?? null,
    timeline: flow.map((s, i) => ({
      status: s,
      title: STEP_TITLE[s],
      time: reached.get(s) ? formatTime(reached.get(s)!, school.timezone) : i === 0 ? formatDay(trip.createdAt, school.timezone) : "—",
      done: i <= index,
    })),
    students: students.map((s) => {
      const m = on.get(s.id);
      return {
        id: s.id,
        name: s.name,
        cls: `${s.grade} · ${s.section}`,
        onTrip: !!m,
        consent: !!m?.consentAt,
        bus: m?.fleetId ? `Bus ${busOf.get(m.fleetId)}` : null,
      };
    }),
  };
}

export const manifestSchema = z.object({ studentIds: z.array(z.string().max(40)).max(1000) });

/** Replace the list of students going. Consent already given is kept. */
export async function setManifest(ctx: Ctx, id: string, studentIds: string[]) {
  const trip = await ownTrip(ctx.db, ctx.schoolId, id);
  if (["COMPLETED", "CANCELLED"].includes(trip.status)) throw conflict("This trip is closed.");
  const valid = await ctx.db.student.findMany({ where: { id: { in: studentIds }, schoolId: ctx.schoolId, deletedAt: null }, select: { id: true } });
  if (valid.length !== new Set(studentIds).size) throw invalid("Some students no longer exist. Reload and try again.");
  const keep = new Set(studentIds);
  await ctx.db.schoolTripStudent.deleteMany({ where: { schoolTripId: id, studentId: { notIn: [...keep] } } });
  const existing = new Set(trip.manifest.map((m) => m.studentId));
  const added = studentIds.filter((s) => !existing.has(s));
  if (added.length) {
    await ctx.db.schoolTripStudent.createMany({ data: added.map((studentId) => ({ schoolTripId: id, studentId })) });
    // Ask each new student's parents for consent.
    for (const studentId of added) {
      await notifyGuardians(ctx.db, ctx.schoolId, studentId, "absence", {
        type: "transport",
        title: `Consent needed: ${trip.name}`,
        body: `${trip.destination} on ${formatDay(trip.date.toISOString().slice(0, 10))}. Please confirm with the class teacher.`,
      });
    }
  }
  ctx.audit({ action: "SCHOOL_TRIP_MANIFEST", entityType: "SchoolTrip", entityId: id, meta: { students: studentIds.length, added: added.length } });
}

export const consentSchema = z.object({ studentId: z.string().min(1), given: z.boolean() });

export async function setConsent(ctx: Ctx, id: string, input: z.infer<typeof consentSchema>) {
  await ownTrip(ctx.db, ctx.schoolId, id);
  const row = await ctx.db.schoolTripStudent.findUnique({
    where: { schoolTripId_studentId: { schoolTripId: id, studentId: input.studentId } },
  });
  if (!row) throw notFound("Student on this trip");
  await ctx.db.schoolTripStudent.update({
    where: { schoolTripId_studentId: { schoolTripId: id, studentId: input.studentId } },
    data: { consentAt: input.given ? new Date() : null },
  });
  ctx.audit({ action: "SCHOOL_TRIP_CONSENT", entityType: "SchoolTrip", entityId: id, meta: { studentId: input.studentId, given: input.given } });
}

export const statusSchema = z.object({
  status: z.enum(["DRAFT", "SCHEDULED", "ON_THE_WAY", "AT_VENUE", "RETURNING", "COMPLETED", "CANCELLED"]),
});

/** Forward one step at a time, or cancel before completion. */
export async function setStatus(ctx: Ctx, id: string, to: SchoolTripStatus) {
  const trip = await ownTrip(ctx.db, ctx.schoolId, id);
  if (to === trip.status) return;
  if (trip.status === "COMPLETED" || trip.status === "CANCELLED") throw conflict("This trip is closed.");
  if (to !== "CANCELLED" && FLOW.indexOf(to) !== FLOW.indexOf(trip.status) + 1) {
    throw conflict(`A trip that is ${trip.status.toLowerCase().replace(/_/g, " ")} moves to ${FLOW[FLOW.indexOf(trip.status) + 1]!.toLowerCase().replace(/_/g, " ")} next.`);
  }
  if (to === "ON_THE_WAY") {
    if (!trip.fleet.length) throw conflict("Assign at least one bus before departure.");
    const missing = trip.manifest.filter((m) => !m.consentAt).length;
    if (missing) throw conflict(`${missing} student${missing === 1 ? " has" : "s have"} no parent consent. Record it or take them off the trip.`);
  }
  await ctx.db.schoolTrip.update({ where: { id }, data: { status: to } });
  if (to === "AT_VENUE" || to === "COMPLETED" || to === "CANCELLED") {
    const title =
      to === "AT_VENUE" ? `Reached ${trip.destination}` : to === "COMPLETED" ? `${trip.name}: back at school` : `${trip.name} is cancelled`;
    for (const m of trip.manifest) {
      await notifyGuardians(ctx.db, ctx.schoolId, m.studentId, "absence", { type: "transport", title, body: trip.name });
    }
  }
  ctx.audit({ action: "SCHOOL_TRIP_STATUS", entityType: "SchoolTrip", entityId: id, meta: { from: trip.status, to } });
}
