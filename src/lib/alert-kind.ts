import type { TripAlertKind } from "@/lib/api/types";

/**
 * Which kind a tracker alert is, for its icon and highlight. Engine alerts
 * say "turned on" or "turned off" in their text.
 */
export function alertKind(type: string, text = ""): TripAlertKind {
  if (type === "overspeed") return "overspeed";
  if (type === "engine_status") return /\boff\b/i.test(text) ? "engine_off" : "engine_on";
  if (["sos", "emergency", "main_power_off", "wire_disconnect", "vibration", "tamper"].includes(type)) return "emergency";
  if (["main_power_undervoltage", "low_battery", "low_external_voltage"].includes(type)) return "power";
  return "other";
}
