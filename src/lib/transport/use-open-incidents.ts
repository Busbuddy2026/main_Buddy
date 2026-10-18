"use client";

import { useApi } from "@/lib/api/use-api";

/** Incidents still New, Under review or Investigating (steps 0–2), for the bell and the nav badge. */
export function useOpenIncidents(): number {
  const feed = useApi<{ items: Array<{ step: number }> }>("/api/admin/incidents");
  return feed.data?.items.filter((i) => i.step < 3).length ?? 0;
}
