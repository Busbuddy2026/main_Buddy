"use client";

import { useApi } from "@/lib/api/use-api";
import { usePoll } from "@/lib/api/use-poll";
import type { BusLive, LiveFleet } from "@/lib/api/types";

/** The admin's live fleet (GET /api/admin/live), refreshed every 15 seconds. */
export function useLiveFleet(ms = 15_000) {
  const live = useApi<LiveFleet>("/api/admin/live");
  usePoll(live.reload, ms);
  return live;
}

/** How a bus reads on the live screens. */
export function liveLabel(b: BusLive): { label: string; kind: "ontime" | "delayed" | "offline" | "good" | "bad" } {
  if (b.state === "unlinked") return { label: "No GPS linked", kind: "offline" };
  if (b.state === "offline") return { label: b.fix ? `GPS offline · ${ago(b.fix.ageMin)}` : "GPS offline", kind: "offline" };
  if (b.trip && b.trip.delayMin > 5) return { label: `Delayed ${b.trip.delayMin} min`, kind: "delayed" };
  if (b.state === "moving") return { label: b.trip ? "On trip" : "Moving", kind: "ontime" };
  if (b.state === "idle") return { label: "Engine on · stopped", kind: "good" };
  return { label: "Parked", kind: "offline" };
}

export function ago(min: number): string {
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}
