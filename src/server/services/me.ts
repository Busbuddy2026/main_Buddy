import "server-only";
import { db } from "@/server/db";
import { readSession } from "@/server/auth/session";
import type { AdminMe, CrewMe, ParentMe } from "@/lib/api/types";
import type { AdminRole } from "@/generated/prisma/client";

/**
 * Who is signed in, shaped for each app's chrome. Layouts call these on the
 * server for first render; the `/api/auth/<app>/session` routes return the
 * same thing to the browser.
 */

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

const ROLE_TITLE: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  TRANSPORT_MANAGER: "Transport Manager",
  OFFICE_STAFF: "Office Staff",
  VIEWER: "Viewer",
};

export async function adminMe(actorId: string, schoolId: string): Promise<AdminMe | null> {
  const [user, school] = await Promise.all([
    db.adminUser.findFirst({ where: { id: actorId, schoolId, deletedAt: null } }),
    db.school.findUnique({ where: { id: schoolId } }),
  ]);
  if (!user || !school) return null;
  return {
    id: user.id,
    name: user.name,
    firstName: user.name.split(" ")[0] ?? user.name,
    initials: initialsOf(user.name),
    email: user.email,
    role: user.role,
    roleTitle: ROLE_TITLE[user.role],
    school: { name: school.name, phone: school.phone },
  };
}

export async function parentMe(actorId: string, schoolId: string): Promise<ParentMe | null> {
  const guardian = await db.guardian.findFirst({
    where: { id: actorId, schoolId, deletedAt: null },
    include: {
      students: {
        where: { student: { deletedAt: null } },
        include: { student: { include: { bus: true, stop: true } } },
        orderBy: { student: { name: "asc" } },
      },
    },
  });
  if (!guardian) return null;
  const prefs = guardian.prefs as Partial<ParentMe["prefs"]> | null;
  return {
    id: guardian.id,
    name: guardian.name,
    firstName: guardian.name.split(" ")[0] ?? guardian.name,
    initials: initialsOf(guardian.name),
    phone: guardian.phone.replace(/^\+91/, ""),
    prefs: {
      alerts: prefs?.alerts ?? true,
      absence: prefs?.absence ?? true,
      digest: prefs?.digest ?? false,
    },
    children: guardian.students.map(({ student: s }) => ({
      id: s.id,
      first: s.name.split(" ")[0] ?? s.name,
      name: s.name,
      initial: s.name.charAt(0),
      cls: `${s.grade} · ${s.section}`,
      roll: s.roll ?? "—",
      bus: s.bus ? `BUS ${s.bus.number}` : "No bus",
      stop: s.stop?.name ?? "No stop",
    })),
  };
}

export async function crewMe(actorId: string, schoolId: string): Promise<CrewMe | null> {
  const crew = await db.crew.findFirst({
    where: { id: actorId, schoolId, deletedAt: null },
    include: {
      attendingBuses: { where: { deletedAt: null }, include: { driver: true, route: true } },
      drivingBuses: { where: { deletedAt: null }, include: { attendant: true, route: true } },
    },
  });
  if (!crew) return null;
  const attending = crew.attendingBuses[0];
  const driving = crew.drivingBuses[0];
  const bus = attending ?? driving ?? null;
  const partner = attending ? attending.driver : driving ? driving.attendant : null;
  const onDuty = crew.status === "ON_DUTY" ? "On duty" : crew.status === "OFF_DUTY" ? "Off duty" : "Idle";
  return {
    id: crew.id,
    name: crew.name,
    initials: initialsOf(crew.name),
    role: `${crew.role === "DRIVER" ? "Driver" : "Attendant"} · ${onDuty}`,
    crewId: crew.crewId,
    phone: crew.phone,
    bus: bus
      ? { id: bus.id, label: `Bus ${bus.number}`, reg: bus.registration, route: bus.route?.name ?? null }
      : null,
    partner: partner
      ? { name: partner.name, initials: initialsOf(partner.name), phone: partner.phone }
      : null,
  };
}

/** For layouts: the signed-in profile for `app`, or null to show sign-in. */
export async function loadAdminMe() {
  const s = await readSession("admin");
  return s ? adminMe(s.actorId, s.schoolId) : null;
}

export async function loadParentMe() {
  const s = await readSession("parent");
  return s ? parentMe(s.actorId, s.schoolId) : null;
}

export async function loadCrewMe() {
  const s = await readSession("crew");
  return s ? crewMe(s.actorId, s.schoolId) : null;
}
