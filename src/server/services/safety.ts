import "server-only";
import { z } from "zod";
import { inParallel, lockSequence, type Tx } from "@/server/db";
import type { Ctx } from "@/server/http/handler";
import { conflict, notFound } from "@/server/http/errors";
import { notifyAdmins } from "@/server/services/notify";
import { bytesLabel } from "@/server/services/masters/view";
import { formatDay, formatTime, localDate } from "@/lib/time";
import { readSettings, type SchoolSettings } from "@/lib/api/schemas/settings";
import type { CameraStatus, IncidentStatus, Severity } from "@/generated/prisma/client";
import type { ToneKind } from "@/lib/transport/tone";

/**
 * Safety: incidents (with an append-only event timeline), the camera
 * registry and its health, recording metadata and backup. Live video and
 * clip playback arrive with the video gateway; until then every view of a
 * camera or a recording is still written to the audit log (non-negotiable 5).
 */

// ── Incidents ─────────────────────────────────────────────────────────────

export const INCIDENT_STEPS: IncidentStatus[] = ["NEW", "UNDER_REVIEW", "INVESTIGATING", "RESOLVED", "CLOSED"];

const STATUS_VIEW: Record<IncidentStatus, { label: string; kind: ToneKind }> = {
  NEW: { label: "New", kind: "bad" },
  UNDER_REVIEW: { label: "Under review", kind: "delayed" },
  INVESTIGATING: { label: "Investigating", kind: "ontime" },
  RESOLVED: { label: "Resolved", kind: "good" },
  CLOSED: { label: "Closed", kind: "offline" },
};

const SEVERITY_VIEW: Record<Severity, { label: string; kind: ToneKind }> = {
  LOW: { label: "Low", kind: "offline" },
  MEDIUM: { label: "Medium", kind: "delayed" },
  HIGH: { label: "High", kind: "bad" },
  CRITICAL: { label: "Critical", kind: "bad" },
};

export async function nextIncidentCode(db: Tx, schoolId: string): Promise<string> {
  await lockSequence(db, `incident-code:${schoolId}`);
  const rows = await db.incident.findMany({ where: { schoolId, code: { not: null } }, select: { code: true } });
  const max = rows.reduce((n, r) => Math.max(n, Number.parseInt(r.code!.replace(/\D/g, ""), 10) || 0), 1000);
  return `INC-${max + 1}`;
}

export interface IncidentRow {
  id: string;
  code: string;
  bus: string;
  type: string;
  when: string;
  severity: { label: string; kind: ToneKind };
  status: { label: string; kind: ToneKind };
  step: number;
  assignedTo: string;
}

export async function listIncidents(db: Tx, schoolId: string) {
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { timezone: true } });
  const rows = await db.incident.findMany({ where: { schoolId }, orderBy: { occurredAt: "desc" }, take: 200 });
  const buses = new Map(
    (await db.bus.findMany({ where: { schoolId }, select: { id: true, number: true } })).map((b) => [b.id, b.number]),
  );
  const items: IncidentRow[] = rows.map((r) => ({
    id: r.id,
    code: r.code ?? r.id.slice(-6),
    bus: r.busId ? `Bus ${buses.get(r.busId) ?? "—"}` : "—",
    type: r.type,
    when: `${formatDay(r.occurredAt, school.timezone).replace(/ \d{4}$/, "")} · ${formatTime(r.occurredAt, school.timezone)}`,
    severity: SEVERITY_VIEW[r.severity],
    status: STATUS_VIEW[r.status],
    step: INCIDENT_STEPS.indexOf(r.status),
    assignedTo: r.assignedTo ?? "Unassigned",
  }));
  const sos = rows.find((r) => r.type === "SOS" && r.status === "NEW");
  return {
    items,
    sos: sos
      ? {
          id: sos.id,
          code: sos.code,
          bus: sos.busId ? `Bus ${buses.get(sos.busId) ?? ""}` : "",
          busNumber: sos.busId ? (buses.get(sos.busId) ?? "") : "",
          description: sos.description,
          at: formatTime(sos.occurredAt, school.timezone),
        }
      : null,
  };
}

export async function incidentDetail(db: Tx, schoolId: string, idOrCode: string) {
  const incident = await db.incident.findFirst({
    where: { schoolId, OR: [{ id: idOrCode }, { code: idOrCode }] },
    include: { events: { orderBy: { createdAt: "asc" } } },
  });
  if (!incident) throw notFound("Incident");
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId }, select: { timezone: true } });
  const tz = school.timezone;

  const [bus, trip, clips, actors] = await inParallel(db, [
    () => (incident.busId ? db.bus.findUnique({ where: { id: incident.busId }, include: { driver: true } }) : Promise.resolve(null)),
    () =>
      incident.tripId
        ? db.trip.findUnique({ where: { id: incident.tripId }, include: { route: true, marks: { where: { undone: false } } } })
        : Promise.resolve(null),
    () => db.recording.findMany({ where: { schoolId, id: { in: incident.clipIds } } }),
    () =>
      Promise.all([
        db.adminUser.findMany({ where: { id: { in: incident.events.map((e) => e.actorId) } }, select: { id: true, name: true } }),
        db.crew.findMany({ where: { id: { in: incident.events.map((e) => e.actorId) } }, select: { id: true, name: true } }),
      ]),
  ] as const);
  const who = new Map([...actors[0], ...actors[1]].map((a) => [a.id, a.name]));
  const boarded = trip ? trip.marks.filter((m) => m.phase === "BOARD" && m.status === "BOARDED").length : null;
  const dropped = trip ? trip.marks.filter((m) => m.phase === "DROP").length : 0;
  const cameras = new Map(
    (await db.camera.findMany({ where: { id: { in: clips.map((c) => c.cameraId) } } })).map((c) => [c.id, c.label]),
  );

  return {
    id: incident.id,
    code: incident.code ?? incident.id.slice(-6),
    type: incident.type,
    description: incident.description,
    severity: incident.severity,
    severityView: SEVERITY_VIEW[incident.severity],
    status: incident.status,
    statusView: STATUS_VIEW[incident.status],
    step: INCIDENT_STEPS.indexOf(incident.status),
    assignedTo: incident.assignedTo ?? "Unassigned",
    occurredAt: `${formatDay(incident.occurredAt, tz)} · ${formatTime(incident.occurredAt, tz)}`,
    bus: bus ? `Bus ${bus.number} · ${bus.registration}` : "—",
    busNumber: bus?.number ?? null,
    driver: bus?.driver?.name ?? "—",
    trip: trip ? `${trip.phase === "MORNING" ? "Morning" : "Evening"} · ${trip.route.name}` : "—",
    onboard: boarded === null ? "—" : String(Math.max(0, boarded - dropped)),
    clips: clips.map((c) => ({
      id: c.id,
      label: `Bus ${bus?.number ?? ""} · ${cameras.get(c.cameraId) ?? "Camera"} · ${formatTime(c.startedAt, tz)} · ${Math.round(c.durationS / 60) || 1} min`,
    })),
    events: incident.events.map((e) => ({
      id: e.id,
      action: e.action,
      note: e.note,
      who: who.get(e.actorId) ?? "System",
      at: `${formatDay(e.createdAt, tz)} · ${formatTime(e.createdAt, tz)}`,
    })),
  };
}

export const incidentCreateSchema = z.object({
  busId: z.string().max(40).optional().transform((v) => v || null),
  type: z.string().trim().min(2, "Say what happened.").max(80),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string().trim().min(5, "Describe the incident.").max(2000),
  assignedTo: z.string().trim().max(120).optional(),
});

export async function createIncident(ctx: Ctx, input: z.infer<typeof incidentCreateSchema>) {
  const { db, schoolId } = ctx;
  if (input.busId) {
    const bus = await db.bus.findFirst({ where: { id: input.busId, schoolId } });
    if (!bus) throw notFound("Bus");
  }
  const incident = await db.incident.create({
    data: {
      schoolId,
      code: await nextIncidentCode(db, schoolId),
      busId: input.busId,
      type: input.type,
      severity: input.severity,
      description: input.description,
      assignedTo: input.assignedTo || ctx.actor.name,
      occurredAt: new Date(),
      clipIds: [],
      events: { create: { actorId: ctx.actor.id, action: "CREATED" } },
    },
  });
  if (input.severity === "HIGH" || input.severity === "CRITICAL") {
    await notifyAdmins(db, schoolId, { type: "alert", title: `${incident.code} · ${input.type}`, body: input.description.slice(0, 140) });
  }
  ctx.audit({ action: "CREATE_INCIDENT", entityType: "Incident", entityId: incident.id, meta: { code: incident.code } });
  return incident.id;
}

export const incidentUpdateSchema = z
  .object({
    status: z.enum(["NEW", "UNDER_REVIEW", "INVESTIGATING", "RESOLVED", "CLOSED"]).optional(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    assignedTo: z.string().trim().max(120).optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.status || v.severity || v.assignedTo !== undefined || v.note, "Nothing to change.");

/** Every change lands on the incident's timeline as well as the audit log. */
export async function updateIncident(ctx: Ctx, id: string, input: z.infer<typeof incidentUpdateSchema>) {
  const { db, schoolId } = ctx;
  const incident = await db.incident.findFirst({ where: { schoolId, id } });
  if (!incident) throw notFound("Incident");
  if (input.status === "CLOSED" && incident.status !== "RESOLVED" && incident.status !== "CLOSED") {
    throw conflict("Resolve the incident before closing it.");
  }

  const events: Array<{ action: string; note: string | null }> = [];
  if (input.status && input.status !== incident.status) {
    events.push({ action: `STATUS_${input.status}`, note: `${STATUS_VIEW[incident.status].label} → ${STATUS_VIEW[input.status].label}` });
  }
  if (input.severity && input.severity !== incident.severity) {
    events.push({ action: "SEVERITY_CHANGED", note: `${SEVERITY_VIEW[incident.severity].label} → ${SEVERITY_VIEW[input.severity].label}` });
  }
  if (input.assignedTo !== undefined && input.assignedTo !== (incident.assignedTo ?? "")) {
    events.push({ action: "ASSIGNED", note: input.assignedTo || "Unassigned" });
  }
  if (input.note) events.push({ action: "NOTE", note: input.note });

  await db.incident.update({
    where: { id },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.severity ? { severity: input.severity } : {}),
      ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo || null } : {}),
      ...(input.status === "RESOLVED" && !incident.resolvedAt ? { resolvedAt: new Date() } : {}),
      events: { create: events.map((e) => ({ ...e, actorId: ctx.actor.id })) },
    },
  });
  ctx.audit({ action: "UPDATE_INCIDENT", entityType: "Incident", entityId: id, meta: { changes: events.map((e) => e.action).join(",") } });
}

// ── Cameras ───────────────────────────────────────────────────────────────

const CAMERA_VIEW: Record<CameraStatus, { label: string; kind: ToneKind }> = {
  ONLINE: { label: "Online", kind: "good" },
  OFFLINE: { label: "Offline", kind: "bad" },
  RECORDING_ISSUE: { label: "Recording issue", kind: "delayed" },
};

function ago(at: Date | null): string {
  if (!at) return "never";
  const min = Math.round((Date.now() - at.getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
}

export async function listCameras(db: Tx, schoolId: string) {
  const cameras = await db.camera.findMany({
    where: { schoolId, bus: { deletedAt: null } },
    include: { bus: { select: { id: true, number: true } } },
    orderBy: [{ bus: { number: "asc" } }, { label: "asc" }],
  });
  const stats = {
    total: cameras.length,
    online: cameras.filter((c) => c.status === "ONLINE").length,
    offline: cameras.filter((c) => c.status === "OFFLINE").length,
    issues: cameras.filter((c) => c.status === "RECORDING_ISSUE").length,
  };
  const byBus = new Map<string, { busId: string; bus: string; lastSeen: string; firmware: string; cameras: Array<{ id: string; label: string; status: CameraStatus; view: { label: string; kind: ToneKind }; lastSeen: string }> }>();
  for (const c of cameras) {
    const entry = byBus.get(c.busId) ?? { busId: c.busId, bus: c.bus.number, lastSeen: "never", firmware: c.firmware ?? "—", cameras: [] };
    entry.cameras.push({ id: c.id, label: c.label, status: c.status, view: CAMERA_VIEW[c.status], lastSeen: ago(c.lastSeenAt) });
    const newest = cameras.filter((x) => x.busId === c.busId && x.lastSeenAt).sort((a, b) => +b.lastSeenAt! - +a.lastSeenAt!)[0];
    entry.lastSeen = ago(newest?.lastSeenAt ?? null);
    byBus.set(c.busId, entry);
  }
  return { stats, buses: [...byBus.values()] };
}

export const cameraUpdateSchema = z.object({ status: z.enum(["ONLINE", "OFFLINE", "RECORDING_ISSUE"]) });

export async function setCameraStatus(ctx: Ctx, id: string, status: CameraStatus) {
  const camera = await ctx.db.camera.findFirst({ where: { id, schoolId: ctx.schoolId } });
  if (!camera) throw notFound("Camera");
  await ctx.db.camera.update({ where: { id }, data: { status, ...(status === "ONLINE" ? { lastSeenAt: new Date() } : {}) } });
  ctx.audit({ action: "CAMERA_STATUS", entityType: "Camera", entityId: id, meta: { from: camera.status, to: status } });
}

/** Opening a camera tile. No stream yet, but the access is still recorded. */
export async function logCameraView(ctx: Ctx, id: string) {
  const camera = await ctx.db.camera.findFirst({ where: { id, schoolId: ctx.schoolId }, include: { bus: true } });
  if (!camera) throw notFound("Camera");
  ctx.audit({ action: "CCTV_VIEW", entityType: "Camera", entityId: id, meta: { bus: camera.bus.number, camera: camera.label } });
}

/** "Raise ticket" on the health page: a tracked incident for the bus's cameras. */
export async function raiseCameraTicket(ctx: Ctx, busId: string) {
  const bus = await ctx.db.bus.findFirst({ where: { id: busId, schoolId: ctx.schoolId }, include: { cameras: true } });
  if (!bus) throw notFound("Bus");
  const faulty = bus.cameras.filter((c) => c.status !== "ONLINE").map((c) => `${c.label} (${CAMERA_VIEW[c.status].label.toLowerCase()})`);
  return createIncident(ctx, {
    busId,
    type: "Camera fault",
    severity: "MEDIUM",
    description: faulty.length
      ? `Support ticket for Bus ${bus.number}: ${faulty.join(", ")}.`
      : `Support ticket for Bus ${bus.number}: cameras reported as working; check requested by the office.`,
    assignedTo: "Fleet Support",
  });
}

// ── Recordings ────────────────────────────────────────────────────────────

const EVENT_LABEL: Record<string, string> = {
  harsh_braking: "Harsh braking event",
  sos: "SOS alert",
  door_open: "Door open",
  manual: "Manual clip",
  scheduled: "Scheduled recording",
};
const EVENT_GROUP: Record<string, "safety" | "stops" | "trip"> = {
  harsh_braking: "safety",
  sos: "safety",
  door_open: "stops",
  manual: "trip",
  scheduled: "trip",
};

export const recordingQuery = z.object({
  busId: z.string().max(40).optional(),
  day: z.iso.date().optional(),
  camera: z.string().max(40).optional(),
  group: z.enum(["safety", "stops", "trip"]).optional(),
});

export async function listRecordings(db: Tx, schoolId: string, q: z.infer<typeof recordingQuery>) {
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
  const tz = school.timezone;
  const settings: SchoolSettings = readSettings(school.settings);
  const all = await db.recording.findMany({ where: { schoolId }, orderBy: { startedAt: "desc" }, take: 2000 });
  const cameras = new Map(
    (await db.camera.findMany({ where: { schoolId }, include: { bus: { select: { number: true } } } })).map((c) => [c.id, c]),
  );
  const today = localDate(new Date(), tz);

  // Backup overview: one row per bus per day.
  const groups = new Map<string, { day: string; busId: string; bus: string; clips: number; bytes: bigint; backedUp: number; expiresAt: Date }>();
  for (const r of all) {
    const day = localDate(r.startedAt, tz);
    const key = `${day}|${r.busId}`;
    const g = groups.get(key) ?? { day, busId: r.busId, bus: cameras.get(r.cameraId)?.bus.number ?? "—", clips: 0, bytes: BigInt(0), backedUp: 0, expiresAt: r.expiresAt };
    g.clips += 1;
    g.bytes += r.sizeBytes;
    if (r.backedUpAt) g.backedUp += 1;
    if (r.expiresAt < g.expiresAt) g.expiresAt = r.expiresAt;
    groups.set(key, g);
  }
  const backups = [...groups.values()].map((g) => {
    const daysLeft = Math.ceil((g.expiresAt.getTime() - Date.now()) / 86_400_000);
    const state = g.backedUp === g.clips ? "Backed up" : daysLeft <= 5 ? `Expiring in ${Math.max(daysLeft, 0)} days` : "On device";
    return {
      day: g.day,
      dayLabel: `${g.day === today ? "Today · " : ""}${formatDay(g.day)}`,
      busId: g.busId,
      bus: `Bus ${g.bus}`,
      clips: `${g.clips} clip${g.clips === 1 ? "" : "s"}`,
      size: bytesLabel(Number(g.bytes)),
      state,
      kind: (state === "Backed up" ? "good" : state === "On device" ? "delayed" : "bad") as ToneKind,
    };
  });

  const clips = all
    .filter((r) => (!q.busId || r.busId === q.busId) && (!q.day || localDate(r.startedAt, tz) === q.day))
    .filter((r) => !q.camera || cameras.get(r.cameraId)?.label === q.camera)
    .filter((r) => !q.group || EVENT_GROUP[r.eventType] === q.group)
    .slice(0, 200)
    .map((r) => ({
      id: r.id,
      bus: `Bus ${cameras.get(r.cameraId)?.bus.number ?? "—"}`,
      camera: cameras.get(r.cameraId)?.label ?? "Camera",
      label: EVENT_LABEL[r.eventType] ?? r.eventType,
      group: EVENT_GROUP[r.eventType] ?? "trip",
      day: localDate(r.startedAt, tz),
      time: formatTime(r.startedAt, tz),
      duration: `${Math.max(1, Math.round(r.durationS / 60))} min`,
      size: bytesLabel(Number(r.sizeBytes)),
      backedUp: !!r.backedUpAt,
    }));

  return {
    drive: settings.cctv,
    retentionDays: settings.retentionDays,
    backups,
    clips,
    days: [...new Set(all.map((r) => localDate(r.startedAt, tz)))].slice(0, 14),
  };
}

export const backupSchema = z.object({
  /** Limit to one bus-day; omit both to back up everything not yet copied. */
  busId: z.string().max(40).optional(),
  day: z.iso.date().optional(),
});

export async function backupRecordings(ctx: Ctx, input: z.infer<typeof backupSchema>) {
  const school = await ctx.db.school.findUniqueOrThrow({ where: { id: ctx.schoolId } });
  const settings = readSettings(school.settings);
  if (!settings.cctv.driveConnected) throw conflict("Connect the school's Drive account before backing up.");
  const rows = await ctx.db.recording.findMany({
    where: { schoolId: ctx.schoolId, backedUpAt: null, ...(input.busId ? { busId: input.busId } : {}) },
    select: { id: true, startedAt: true },
  });
  const ids = rows.filter((r) => !input.day || localDate(r.startedAt, school.timezone) === input.day).map((r) => r.id);
  // TODO(drive): copy each clip to the school's Drive folder before stamping it.
  await ctx.db.recording.updateMany({ where: { id: { in: ids } }, data: { backedUpAt: new Date() } });
  ctx.audit({ action: "CCTV_BACKUP", meta: { clips: ids.length, busId: input.busId ?? null, day: input.day ?? null } });
  return { clips: ids.length };
}

export const driveSchema = z.object({
  connected: z.boolean(),
  account: z.string().trim().max(200).optional(),
});

export async function setDrive(ctx: Ctx, input: z.infer<typeof driveSchema>) {
  const school = await ctx.db.school.findUniqueOrThrow({ where: { id: ctx.schoolId } });
  const settings = readSettings(school.settings);
  settings.cctv = { driveConnected: input.connected, driveAccount: input.connected ? (input.account || settings.cctv.driveAccount) : "" };
  await ctx.db.school.update({ where: { id: ctx.schoolId }, data: { settings } });
  ctx.audit({ action: input.connected ? "DRIVE_CONNECTED" : "DRIVE_DISCONNECTED", meta: { account: settings.cctv.driveAccount } });
  return settings.cctv;
}

/** Opening a recording: audited even though playback arrives with the gateway. */
export async function logRecordingView(ctx: Ctx, id: string) {
  const rec = await ctx.db.recording.findFirst({ where: { id, schoolId: ctx.schoolId } });
  if (!rec) throw notFound("Recording");
  ctx.audit({ action: "RECORDING_VIEW", entityType: "Recording", entityId: id, meta: { busId: rec.busId } });
}
