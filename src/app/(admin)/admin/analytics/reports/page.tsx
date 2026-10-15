"use client";

import { useState } from "react";
import { Card, Icon, Mono, SecondaryButton } from "@/components/transport/ui";
import { addDays, formatDay, localDate } from "@/lib/time";

const REPORTS = [
  {
    kind: "attendance",
    icon: "how_to_reg",
    title: "Attendance register",
    body: "One row per student per trip: boarding and drop status, stop, time and who marked it.",
  },
  {
    kind: "trips",
    icon: "directions_bus",
    title: "Trip performance",
    body: "Every trip with its bus, crew, start and finish times, delay and head counts.",
  },
  {
    kind: "incidents",
    icon: "report",
    title: "Safety incidents",
    body: "Incidents with severity, status, owner and resolution date.",
  },
] as const;

const SPANS = [7, 30, 90] as const;

/**
 * Downloadable reports (CSV) from GET /api/admin/reports/:kind. Each download
 * is written to the audit log. Scheduled email delivery comes later.
 */
export default function ReportsPage() {
  const [span, setSpan] = useState<number>(30);
  const to = localDate();
  const from = addDays(to, -(span - 1));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-control bg-neutral-tint p-1">
          {SPANS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSpan(d)}
              aria-pressed={span === d}
              className="rounded-chip px-3 py-1.5 text-[12px] font-semibold"
              style={{ background: span === d ? "#fff" : "transparent", color: span === d ? "#16181b" : "#5f6672" }}
            >
              Last {d} days
            </button>
          ))}
        </div>
        <span className="text-[13px] text-muted">
          <Mono>{formatDay(from)}</Mono> – <Mono>{formatDay(to)}</Mono>
        </span>
      </div>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {REPORTS.map((r) => (
          <Card key={r.kind} className="flex flex-col px-5 py-[18px]">
            <span className="mb-3 grid size-10 place-items-center rounded-xl bg-neutral-tint text-muted">
              <Icon name={r.icon} size={22} />
            </span>
            <div className="text-sm font-semibold">{r.title}</div>
            <p className="mt-1 flex-1 text-[12.5px] leading-[1.5] text-faint text-pretty">{r.body}</p>
            <div className="mt-4">
              <SecondaryButton icon="download" href={`/api/admin/reports/${r.kind}?from=${from}&to=${to}`}>
                Download CSV
              </SecondaryButton>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
