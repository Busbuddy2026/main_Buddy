"use client";

import Link from "next/link";
import { Mono, StatusPill } from "@/components/transport/ui";
import type { BusLive } from "@/lib/api/types";
import { pill } from "@/lib/transport/tone";
import { liveLabel } from "@/lib/transport/use-live";

/** The floating card for the selected bus. */
export function BusCard({ bus }: { bus: BusLive }) {
  const l = liveLabel(bus);
  return (
    <div
      className="absolute right-4 top-4 z-[500] w-72 overflow-hidden rounded-card border border-line bg-surface"
      style={{ boxShadow: "var(--shadow-float)" }}
    >
      <div className="border-b border-line-soft px-4 pb-3 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <Mono className="text-[17px] font-semibold tracking-[-0.02em]">Bus {bus.number}</Mono>
          <StatusPill pill={pill(l.label, l.kind)} />
        </div>
        <div className="mt-0.5 truncate text-xs text-faint">{bus.route ?? "No route"}</div>
      </div>
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-3 px-4 py-3">
        <MiniFact label="DRIVER" value={bus.driver ?? "—"} />
        <MiniFact label="ATTENDANT" value={bus.attendant ?? "—"} />
        <MiniFact label="ONBOARD" value={`${bus.trip?.onboard ?? 0} / ${bus.capacity}`} mono />
        <MiniFact label="SPEED" value={bus.fix ? `${bus.fix.speed} km/h` : "—"} mono />
      </div>
      <div className="px-4 pb-3">
        <div className="rounded-control bg-canvas px-3 py-[11px]">
          <div className="text-[10.5px] tracking-[0.02em] text-faint">{bus.trip?.nextStop ? "NEXT STOP" : "LAST KNOWN"}</div>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <div className="truncate text-[13.5px] font-semibold">
              {bus.trip?.nextStop?.name ?? bus.fix?.address ?? (bus.linked ? "Waiting for the first fix" : "No GPS linked")}
            </div>
            {bus.trip?.nextStop ? (
              <Mono className="shrink-0 text-[12.5px] font-semibold text-primary">{bus.trip.nextStop.etaMin} min</Mono>
            ) : null}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        <Link href="/admin/cctv" className="rounded-[9px] bg-primary py-[9px] text-center text-[12.5px] font-semibold text-white hover:bg-primary-hover">
          Live CCTV
        </Link>
        <Link href={`/admin/buses/${bus.number}`} className="rounded-[9px] border border-line py-[9px] text-center text-[12.5px] font-semibold text-ink-2 hover:bg-canvas">
          Open bus
        </Link>
      </div>
    </div>
  );
}

function MiniFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] tracking-[0.03em] text-faint">{label}</div>
      <div className={`mt-0.5 truncate text-[12.5px] font-semibold ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
