import type { AdminRole } from "./types";

/**
 * Who may open live dashcam video. The stream route enforces it and the
 * settings page lists it, so the two cannot drift apart.
 */
export const CCTV_LIVE_ROLES: AdminRole[] = ["SUPER_ADMIN", "TRANSPORT_MANAGER", "OFFICE_STAFF"];
