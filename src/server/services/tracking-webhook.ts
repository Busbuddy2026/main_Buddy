import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { dbDate, localDate } from "@/lib/time";
import { raiseIncident } from "@/server/services/tracking";
import type { Severity } from "@/generated/prisma/client";

/**
 * LivePin webhooks. The vendor does not sign payloads; it echoes the secret we
 * registered in `X-Webhook-Secret`, compared here in constant time. The
 * delivery wraps the event as a JSON string in `body`.
 */

const RULES: Record<string, { type: string; severity: Severity; notify: boolean }> = {
  sos: { type: "SOS", severity: "CRITICAL", notify: true },
  emergency: { type: "SOS", severity: "CRITICAL", notify: true },
  overspeed: { type: "Overspeed", severity: "LOW", notify: false },
  geofence: { type: "Geofence alert", severity: "LOW", notify: false },
};
const REPEAT_MS = 30 * 60_000;

const eventSchema = z.object({
  notification: z.object({
    notification_type: z.string(),
    imei: z.union([z.string(), z.number()]).transform(String),
    title: z.string().nullish(),
    timestamp: z.coerce.number().nullish(),
    location: z.object({ latitude: z.coerce.number(), longitude: z.coerce.number() }).nullish(),
  }),
});

export function secretMatches(sent: string | null, expected: string | undefined): boolean {
  if (!sent || !expected || sent.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
}

/** The event, whether delivered wrapped (`{ body: "<json>" }`) or bare. */
export function parseDelivery(raw: unknown) {
  let payload: unknown = raw;
  const wrapped = (raw as { body?: unknown } | null)?.body;
  if (typeof wrapped === "string") {
    try {
      payload = JSON.parse(wrapped);
    } catch {
      return null;
    }
  } else if (wrapped && typeof wrapped === "object") {
    payload = wrapped;
  }
  const r = eventSchema.safeParse(payload);
  return r.success ? r.data.notification : null;
}

export async function handleLivepinWebhook(request: Request): Promise<Response> {
  if (!secretMatches(request.headers.get("x-webhook-secret"), process.env.LIVEPIN_WEBHOOK_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const event = parseDelivery(await request.json().catch(() => null));
  // Acknowledge anything well-formed fast; unknown events are ignored.
  if (!event) return Response.json({ ok: true, ignored: "unreadable" });
  const rule = RULES[event.notification_type.toLowerCase()];
  if (!rule) return Response.json({ ok: true, ignored: event.notification_type });

  const device = await db.gpsDevice.findFirst({ where: { imei: event.imei.replace(/'/g, ""), busId: { not: null } } });
  if (!device?.busId) return Response.json({ ok: true, ignored: "unlinked device" });

  const at = event.timestamp ? new Date(event.timestamp) : new Date();
  const state = { ...((device.alarmState as Record<string, string>) ?? {}) };
  if (state[rule.type] && Date.now() - Date.parse(state[rule.type]!) < REPEAT_MS) {
    return Response.json({ ok: true, duplicate: true });
  }
  state[rule.type] = new Date().toISOString();

  await db.$transaction(async (tx) => {
    const bus = await tx.bus.findUniqueOrThrow({ where: { id: device.busId! } });
    const trip = await tx.trip.findFirst({ where: { busId: bus.id, date: dbDate(localDate()), status: "ACTIVE" } });
    await tx.gpsDevice.update({ where: { id: device.id }, data: { alarmState: state } });
    await raiseIncident(
      tx,
      device.schoolId,
      bus,
      trip?.id ?? null,
      rule,
      {
        lat: event.location?.latitude ?? device.lastLat ?? 0,
        lng: event.location?.longitude ?? device.lastLng ?? 0,
        speed: device.lastSpeed ?? 0,
        at,
      },
      "a LivePin alert",
    );
  });
  return Response.json({ ok: true });
}
