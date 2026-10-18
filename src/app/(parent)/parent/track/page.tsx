"use client";

import Link from "next/link";
import { LiveMap, oneBusMap } from "@/components/transport/live-map";
import { Icon, Mono } from "@/components/transport/ui";
import { useApi } from "@/lib/api/use-api";
import { usePoll } from "@/lib/api/use-poll";
import { useParent } from "@/lib/transport/parent-store";
import { TONE } from "@/lib/transport/tone";
import type { ChildToday } from "@/server/services/parent";

/**
 * B3 — live tracking. Parents see only their own child's bus and stop; home
 * addresses never appear here (README §6).
 */
export default function ParentTrackPage() {
  const { child } = useParent();
  const today = useApi<ChildToday>(child.id ? `/api/parent/children/${child.id}/today` : null);
  usePoll(today.reload, 30_000);
  const t = today.data;
  const tone = TONE[t?.status.kind ?? "offline"];
  const busNumber = t?.bus?.replace("Bus ", "") ?? "";
  const last = [...(t?.journey ?? [])].reverse().find((j) => j.state === "done");

  return (
    <div className="relative h-full min-h-[420px] w-full">
      {/* The bus shows only while this child's trip is running (README §6). */}
      <LiveMap {...oneBusMap(busNumber, t?.live ?? null)} />

      <div className="absolute inset-x-3 top-3.5 z-[500] flex items-center gap-2.5 sm:inset-x-4">
        <Link
          href="/parent"
          aria-label="Back"
          className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-surface shadow-[0_2px_10px_rgba(16,24,40,.16)]"
        >
          <Icon name="arrow_back" size={20} />
        </Link>
        <div className="min-w-0 flex-1 rounded-xl bg-surface px-3.5 py-[9px] shadow-[0_2px_10px_rgba(16,24,40,.16)]">
          <div className="text-[13px] font-semibold">
            {t?.bus ?? child.bus} ·{" "}
            {t?.live ? (t.live.offline ? "GPS signal lost" : "Live") : t?.tracking === "no-gps" ? "No GPS on this bus" : "Not on a trip"}
          </div>
          <div className="text-[11px] text-faint">
            {t?.live
              ? `${t.route ?? ""} · updated ${t.live.ageMin} min ago`
              : t?.tracking === "no-gps"
                ? "The trip is running; this bus has no tracker yet."
                : "You can see the bus while your child's trip is running."}
          </div>
        </div>
      </div>

      <div className="absolute inset-x-3 bottom-[calc(14px+env(safe-area-inset-bottom))] z-[500] rounded-[20px] bg-surface p-4 shadow-[0_10px_34px_rgba(16,24,40,.2)] sm:inset-x-3.5 sm:bottom-3.5 sm:p-[18px]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[17px] font-semibold tracking-[-0.02em]">{t?.bus ?? child.bus}</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11.5px] font-semibold"
            style={{ background: tone.bg, color: tone.fg }}
          >
            <span className="size-1.5 rounded-full" style={{ background: tone.dot }} />
            {t?.status.label ?? "Loading…"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3.5">
          <div>
            <div className="text-[10.5px] text-faint">{t?.live?.toStop ? "REACHES YOUR STOP" : "TRIP"}</div>
            <div className="text-xl font-semibold tracking-[-0.02em]">
              {t?.live?.toStop && !t.live.offline
                ? `${t.live.toStop.etaMin} min · ${t.live.toStop.distanceKm} km`
                : t?.phase === "evening" ? "Evening" : "Morning"}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] text-faint">
              {t?.phase === "evening" ? "SCHEDULED DROP" : "SCHEDULED PICKUP"}
            </div>
            <Mono className="text-xl font-semibold tracking-[-0.02em] text-primary">{t?.scheduled ?? "—"}</Mono>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-[9px] rounded-[13px] bg-canvas px-[13px] py-3">
          <Icon name="location_on" size={19} className="text-muted" />
          <div className="min-w-0">
            <div className="text-[10.5px] text-faint">YOUR STOP</div>
            <div className="truncate text-[13px] font-semibold">{t?.stop ?? child.stop}</div>
          </div>
        </div>

        <p className="mt-3 text-[11.5px] text-faint">
          {last ? `${last.title} · ${last.time}` : `No updates yet for ${child.name} today.`}
        </p>
      </div>
    </div>
  );
}
