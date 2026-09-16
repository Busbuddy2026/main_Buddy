"use client";

import { Mono } from "@/components/transport/ui";
import { HISTORY_DAYS } from "@/lib/transport/parent";
import { useParent } from "@/lib/transport/parent-store";

/** B5 — day-grouped transport history. */
export default function ParentHistoryPage() {
  const { child } = useParent();

  return (
    <div className="px-5 pb-5 pt-3.5">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Transport history</h1>
      <p className="mt-[3px] text-[12.5px] text-faint">
        {child.name} · {child.bus}
      </p>

      {HISTORY_DAYS.map((d) => (
        <div key={d.label} className="mt-5 overflow-hidden rounded-[18px] border border-line">
          <div className="flex items-center justify-between gap-3 border-b border-line-rule px-4 py-[13px]">
            <div className="text-[13.5px] font-semibold">{d.label}</div>
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-pill px-[9px] py-1 text-[11px] font-semibold"
              style={{ background: d.tone.bg, color: d.tone.fg }}
            >
              <span className="size-1.5 rounded-full" style={{ background: d.tone.dot }} />
              {d.status}
            </span>
          </div>
          <div className="px-4 py-3.5">
            {d.rows.map((r) => (
              <div key={r.label} className="grid grid-cols-[66px_minmax(0,1fr)] gap-3 py-1.5">
                <Mono className="text-xs text-faint">{r.time}</Mono>
                <div className="text-[13px] font-medium">{r.label}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
