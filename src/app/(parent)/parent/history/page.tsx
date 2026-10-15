"use client";

import { Mono } from "@/components/transport/ui";
import { useApi } from "@/lib/api/use-api";
import { useParent } from "@/lib/transport/parent-store";
import { TONE } from "@/lib/transport/tone";
import type { HistoryDayView } from "@/server/services/parent";

/** B5 — day-grouped transport history, the last two weeks. */
export default function ParentHistoryPage() {
  const { child } = useParent();
  const history = useApi<HistoryDayView[]>(child.id ? `/api/parent/children/${child.id}/history` : null);
  const HISTORY_DAYS = (history.data ?? []).map((d) => ({ ...d, tone: TONE[d.kind] }));

  return (
    <div className="px-5 pb-5 pt-3.5">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Transport history</h1>
      <p className="mt-[3px] text-[12.5px] text-faint">
        {child.name} · {child.bus}
      </p>

      {history.data && HISTORY_DAYS.length === 0 ? (
        <div className="mt-5 rounded-[18px] border border-dashed border-line px-4 py-12 text-center text-[13px] text-faint">
          No trips in the last two weeks.
        </div>
      ) : null}
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
              <div key={`${r.time}-${r.label}`} className="grid grid-cols-[66px_minmax(0,1fr)] gap-3 py-1.5">
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
