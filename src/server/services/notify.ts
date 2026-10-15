import "server-only";
import type { Tx } from "@/server/db";

/**
 * In-app notifications. Each one is a row the parent app (or the admin
 * console) reads; push delivery plugs in here later without changing callers.
 *
 * Guardian preferences gate sending (README §7): `alerts` covers boarding and
 * drop scans, `absence` covers delays and route changes.
 */

export type GuardianPref = "alerts" | "absence" | "digest";
export type NotificationKind = "attendance" | "transport" | "alert";

export async function notifyGuardians(
  db: Tx,
  schoolId: string,
  studentId: string,
  pref: GuardianPref,
  message: { type: NotificationKind; title: string; body: string; at?: Date },
): Promise<number> {
  const links = await db.studentGuardian.findMany({
    where: { studentId, guardian: { schoolId, deletedAt: null } },
    include: { guardian: { select: { id: true, prefs: true } } },
  });
  const targets = links.filter(({ guardian }) => {
    const prefs = guardian.prefs as Partial<Record<GuardianPref, boolean>> | null;
    return prefs?.[pref] ?? pref !== "digest";
  });
  if (!targets.length) return 0;
  await db.notification.createMany({
    data: targets.map(({ guardian }) => ({
      schoolId,
      audience: "GUARDIAN" as const,
      guardianId: guardian.id,
      studentId,
      type: message.type,
      title: message.title,
      body: message.body,
      sentAt: message.at ?? new Date(),
    })),
  });
  return targets.length;
}

/** A console alert for the transport office (SOS, incidents). */
export async function notifyAdmins(
  db: Tx,
  schoolId: string,
  message: { type: NotificationKind; title: string; body: string; at?: Date },
): Promise<void> {
  await db.notification.create({
    data: {
      schoolId,
      audience: "ADMIN",
      type: message.type,
      title: message.title,
      body: message.body,
      sentAt: message.at ?? new Date(),
    },
  });
}
