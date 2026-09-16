"use client";

import Link from "next/link";
import { LiveMap } from "@/components/transport/live-map";
import { Icon, Mono } from "@/components/transport/ui";
import { useParent } from "@/lib/transport/parent-store";

/**
 * B3 — live tracking. Parents see only their own child's bus and stop; home
 * addresses never appear here (README §6).
 */
export default function ParentTrackPage() {
  const { child } = useParent();

  return (
    <div className="relative min-h-[640px] w-full">
      <LiveMap focus="12" selected="12" />

      <div className="absolute inset-x-4 top-3.5 z-[500] flex items-center gap-2.5">
        <Link
          href="/parent"
          aria-label="Back"
          className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-surface shadow-[0_2px_10px_rgba(16,24,40,.16)]"
        >
          <Icon name="arrow_back" size={20} />
        </Link>
        <div className="min-w-0 flex-1 rounded-xl bg-surface px-3.5 py-[9px] shadow-[0_2px_10px_rgba(16,24,40,.16)]">
          <div className="text-[13px] font-semibold">Bus 12 · Live</div>
          <div className="text-[11px] text-faint">Kondapur → School</div>
        </div>
      </div>

      <div className="absolute inset-x-3.5 bottom-3.5 z-[500] rounded-[20px] bg-surface p-[18px] shadow-[0_10px_34px_rgba(16,24,40,.2)]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[17px] font-semibold tracking-[-0.02em]">Bus 12</span>
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-primary-tint px-2.5 py-1 text-[11.5px] font-semibold text-primary-hover">
            <span className="size-1.5 rounded-full bg-primary" />
            On the way
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3.5">
          <div>
            <div className="text-[10.5px] text-faint">DISTANCE FROM YOUR STOP</div>
            <Mono className="text-xl font-semibold tracking-[-0.02em]">2.3 km</Mono>
          </div>
          <div>
            <div className="text-[10.5px] text-faint">ESTIMATED ARRIVAL</div>
            <Mono className="text-xl font-semibold tracking-[-0.02em] text-primary">7 min</Mono>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-[9px] rounded-[13px] bg-canvas px-[13px] py-3">
          <Icon name="location_on" size={19} className="text-muted" />
          <div className="min-w-0">
            <div className="text-[10.5px] text-faint">NEXT STOP</div>
            <div className="truncate text-[13px] font-semibold">{child.stop}</div>
          </div>
        </div>

        <p className="mt-3 text-[11.5px] text-faint">
          {child.name} boarded at 6:42 AM and is onboard now.
        </p>
      </div>
    </div>
  );
}
