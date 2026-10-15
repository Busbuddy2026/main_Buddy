"use client";

import { useEffect, useState } from "react";
import {
  Card,
  Mono,
  ProgressBar,
  SecondaryButton,
  TableWrap,
  Td,
  Th,
  Toolbar,
} from "@/components/transport/ui";
import { api } from "@/lib/api/client";
import { addDays, formatDay, localDate } from "@/lib/time";

interface Day {
  date: string;
  expected: number;
  boarded: number;
  absent: number;
  dropped: number;
}

const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
] as const;

const n = (v: number) => v.toLocaleString("en-IN");

/** Daily rollups from GET /api/admin/attendance/history. */
export default function AttendanceHistoryPage() {
  const [span, setSpan] = useState<number>(14);
  const [days, setDays] = useState<Day[] | null>(null);
  const to = localDate();
  const from = addDays(to, -(span - 1));

  useEffect(() => {
    let live = true;
    api
      .get<{ days: Day[] }>("/api/admin/attendance/history", { query: { from, to } })
      .then((res) => live && setDays(res.days))
      .catch(() => live && setDays([]));
    return () => {
      live = false;
    };
  }, [from, to]);

  const ROWS = (days ?? []).map((d) => {
    const marked = d.boarded + d.absent;
    return {
      date: formatDay(d.date),
      expected: n(d.expected),
      boarded: n(d.boarded),
      absent: n(d.absent),
      dropped: n(d.dropped),
      pct: `${d.expected ? Math.min(100, Math.round((marked / d.expected) * 100)) : 0}%`,
    };
  });

  return (
    <div className="flex flex-col gap-3.5">
      <Toolbar>
        <div className="flex gap-1 rounded-control bg-neutral-tint p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setSpan(r.days)}
              aria-pressed={span === r.days}
              className="rounded-chip px-3 py-1.5 text-[12px] font-semibold"
              style={{ background: span === r.days ? "#fff" : "transparent", color: span === r.days ? "#16181b" : "#5f6672" }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="text-[13px] text-muted">
          <Mono>{formatDay(from)}</Mono> – <Mono>{formatDay(to)}</Mono>
        </span>
        <div className="flex-1" />
        <SecondaryButton icon="download" href={`/api/admin/attendance/export?from=${from}&to=${to}`}>
          Export CSV
        </SecondaryButton>
      </Toolbar>

      <Card className="overflow-hidden">
        <TableWrap minWidth={700}>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Expected</Th>
              <Th>Boarded</Th>
              <Th>Absent</Th>
              <Th>Dropped</Th>
              <Th>Completion</Th>
            </tr>
          </thead>
          <tbody>
            {days !== null && ROWS.length === 0 ? (
              <tr>
                <Td className="py-10 text-center text-faint" colSpan={6}>
                  No trips recorded in this range.
                </Td>
              </tr>
            ) : null}
            {ROWS.map((h) => (
              <tr key={h.date} className="hover:bg-[#fafbfc]">
                <Td className="text-[13px] font-medium text-ink">{h.date}</Td>
                <Td>
                  <Mono>{h.expected}</Mono>
                </Td>
                <Td>
                  <Mono className="text-success-text">{h.boarded}</Mono>
                </Td>
                <Td>
                  <Mono className="text-critical-text">{h.absent}</Mono>
                </Td>
                <Td>
                  <Mono className="text-primary-hover">{h.dropped}</Mono>
                </Td>
                <Td className="min-w-[150px]">
                  <div className="flex items-center gap-2.5">
                    <ProgressBar pct={h.pct} color="#1e8e3e" track="#eceef1" className="flex-1" />
                    <Mono className="w-10 text-right text-[11.5px] text-muted">{h.pct}</Mono>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}
