"use client";

import Link from "next/link";
import { Icon, Mono, StatusPill } from "@/components/transport/ui";
import { useStore } from "@/lib/transport/store";
import { TONE, pill } from "@/lib/transport/tone";
import { ago, liveLabel, useLiveFleet } from "@/lib/transport/use-live";

/** Every bus as a card: who is on it, GPS and camera health. */
export default function BusMonitoringPage() {
  const { dispatch } = useStore();
  const live = useLiveFleet();

  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
      {(live.data?.buses ?? []).map((b) => {
        const l = liveLabel(b);
        const gps = !b.linked ? TONE.offline : b.state === "offline" ? TONE.bad : TONE.good;
        const cam = !b.camerasTotal ? TONE.offline : b.camerasOnline === b.camerasTotal ? TONE.good : b.camerasOnline ? TONE.delayed : TONE.bad;
        return (
          <Link
            key={b.busId}
            href={`/admin/buses/${b.number}`}
            onClick={() => dispatch({ type: "selectBus", id: b.number })}
            className="rounded-[14px] border border-line bg-surface p-4 hover:border-[#c9ced6]"
          >
            <div className="flex items-center justify-between gap-2">
              <Mono className="text-[15px] font-semibold text-ink">Bus {b.number}</Mono>
              <StatusPill pill={pill(l.label, l.kind)} />
            </div>
            <Mono className="mt-[3px] block text-xs text-faint">
              {b.reg}
              {b.vehicleNo ? ` · tracker ${b.vehicleNo}` : ""}
            </Mono>
            <div className="my-[13px] h-px bg-line-rule" />
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <div className="text-[10.5px] text-faint">DRIVER</div>
                <div className="text-[12.5px] font-medium text-ink">{b.driver ?? "Unassigned"}</div>
              </div>
              <div>
                <div className="text-[10.5px] text-faint">ONBOARD</div>
                <Mono className="text-[12.5px] font-medium text-ink">
                  {b.trip?.onboard ?? 0} / {b.capacity}
                </Mono>
              </div>
            </div>
            <div className="mt-[13px] flex flex-wrap gap-[7px]">
              <span className="inline-flex items-center gap-1.5 rounded-[7px] px-[9px] py-1 text-[11px] font-medium" style={{ background: gps.bg, color: gps.fg }}>
                <Icon name={b.linked && b.state !== "offline" ? "my_location" : "gps_off"} size={14} />
                {!b.linked ? "GPS not linked" : b.fix ? `GPS ${ago(b.fix.ageMin)}` : "No fix yet"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-[7px] px-[9px] py-1 text-[11px] font-medium" style={{ background: cam.bg, color: cam.fg }}>
                <Icon name="videocam" size={14} />
                {b.camerasTotal ? `${b.camerasOnline} / ${b.camerasTotal}` : "No cameras"}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
