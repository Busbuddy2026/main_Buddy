import { handleLivepinWebhook } from "@/server/services/tracking-webhook";

/**
 * POST /api/webhooks/livepin — vendor alerts (SOS, overspeed, geofence).
 * Verified by the shared secret in `X-Webhook-Secret`; register the URL in
 * the LivePin dashboard (Profile → Webhooks) once deployed on https.
 */
export async function POST(request: Request): Promise<Response> {
  return handleLivepinWebhook(request);
}
