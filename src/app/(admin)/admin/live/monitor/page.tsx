"use client";

import Link from "next/link";
import { Icon, Mono, StatusPill } from "@/components/transport/ui";
import { busRows } from "@/lib/transport/derive";
import { useData, useStore } from "@/lib/transport/store";

export default function BusMonitoringPage() {
  const data = useData();
  const { dispatch } = useStore();
  const rows = busRows(data);

  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
      {rows.map((b) => (
        <Link
          key={b.id}
          href={`/admin/buses/${b.trackedId}`}
          onClick={() => dispatch({ type: "selectBus", id: b.trackedId })}
          className="rounded-[14px] border border-line bg-surface p-4 hover:border-[#c9ced6]"
        >
          <div className="flex items-center justify-between gap-2">
            <Mono className="text-[15px] font-semibold text-ink">Bus {b.id}</Mono>
            <StatusPill pill={b.statusPill} />
          </div>
          <Mono className="mt-[3px] block text-xs text-faint">{b.reg}</Mono>
          <div className="my-[13px] h-px bg-line-rule" />
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <div className="text-[10.5px] text-faint">DRIVER</div>
              <div className="text-[12.5px] font-medium text-ink">{b.driver}</div>
            </div>
            <div>
              <div className="text-[10.5px] text-faint">ONBOARD</div>
              <Mono className="text-[12.5px] font-medium text-ink">{b.ratio}</Mono>
            </div>
          </div>
          <div className="mt-[13px] flex flex-wrap gap-[7px]">
            <span
              className="inline-flex items-center gap-1.5 rounded-[7px] px-[9px] py-1 text-[11px] font-medium"
              style={{ background: b.gps.bg, color: b.gps.fg }}
            >
              <Icon name="my_location" size={14} />
              GPS {b.gps.label}
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-[7px] px-[9px] py-1 text-[11px] font-medium"
              style={{ background: b.cam.bg, color: b.cam.fg }}
            >
              <Icon name="videocam" size={14} />
              {b.cam.label}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
