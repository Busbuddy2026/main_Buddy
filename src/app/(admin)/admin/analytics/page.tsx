"use client";

import { Card, Mono, ProgressBar } from "@/components/transport/ui";

const KPIS = [
  { label: "Total trips", value: "1,148", delta: "+3.2% vs last month", deltaColor: "#186c33" },
  { label: "On-time rate", value: "94.6%", delta: "+1.1 pts", deltaColor: "#186c33" },
  { label: "Average delay", value: "4.2 min", delta: "+0.4 min", deltaColor: "#8f5b00" },
  { label: "Bus utilisation", value: "86%", delta: "Seats filled on average", deltaColor: "#8b919b" },
];

/** On-time percentage per day, last 14 days. Bars are scaled from an 80% floor. */
const SERIES = [92, 95, 89, 97, 94, 96, 91, 98, 93, 95, 88, 96, 97, 94];

const ATTENDANCE = [
  { label: "Boarding rate", value: "95.4%", width: "95%", color: "#1e8e3e" },
  { label: "Absence rate", value: "4.2%", width: "4%", color: "#d93025" },
  { label: "Pending marks", value: "0.4%", width: "2%", color: "#f29900" },
];

const SAFETY = [
  ["Speed events", "28"],
  ["Harsh braking", "14"],
  ["Route deviations", "6"],
  ["Incidents raised", "9"],
] as const;

const BUSIEST = [
  { route: "Madhapur → School", count: "48", width: "96%" },
  { route: "Kondapur → School", count: "42", width: "84%" },
  { route: "Gachibowli → School", count: "40", width: "80%" },
];

export default function AnalyticsPage() {
  const bars = SERIES.map((v, i) => ({
    height: `${Math.round(((v - 80) / 20) * 100)}%`,
    color: v >= 95 ? "#1a73e8" : v >= 90 ? "#8ab4f8" : "#f29900",
    label: ((i + 24) % 30) + 1,
    value: v,
  }));

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {KPIS.map((k) => (
          <Card key={k.label} className="px-[18px] py-4">
            <div className="text-xs text-muted">{k.label}</div>
            <Mono className="mt-1 block text-[30px] font-medium tracking-[-0.03em]">{k.value}</Mono>
            <div className="mt-0.5 text-[11.5px]" style={{ color: k.deltaColor }}>
              {k.delta}
            </div>
          </Card>
        ))}
      </div>

      <Card className="px-[22px] py-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[13.5px] font-semibold">On-time performance</div>
            <div className="text-[11.5px] text-faint">
              Percentage of trips completed within 5 minutes of schedule
            </div>
          </div>
          <div className="text-xs text-faint">Last 14 days</div>
        </div>
        <div className="flex h-[180px] items-end gap-2.5">
          {bars.map((b) => (
            <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
              <div
                title={`${b.value}% on time`}
                className="w-full rounded-t-md"
                style={{ height: b.height, background: b.color }}
              />
              <Mono className="text-[10px] text-faint">{b.label}</Mono>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-[18px] lg:grid-cols-3">
        <Card className="px-5 py-[18px]">
          <div className="mb-3.5 text-[13.5px] font-semibold">Student attendance</div>
          <div className="flex flex-col gap-[13px]">
            {ATTENDANCE.map((a) => (
              <div key={a.label}>
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-muted">{a.label}</span>
                  <Mono className="font-semibold">{a.value}</Mono>
                </div>
                <ProgressBar pct={a.width} color={a.color} track="#eceef1" className="mt-1.5" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-5 py-[18px]">
          <div className="mb-3.5 text-[13.5px] font-semibold">Safety events</div>
          <div className="flex flex-col gap-[11px]">
            {SAFETY.map(([label, value], i) => (
              <div key={label}>
                {i > 0 ? <div className="mb-[11px] h-px bg-line-rule" /> : null}
                <div className="flex justify-between gap-3">
                  <span className="text-[12.5px] text-muted">{label}</span>
                  <Mono className="text-[12.5px] font-semibold">{value}</Mono>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-5 py-[18px]">
          <div className="mb-3.5 text-[13.5px] font-semibold">Busiest routes</div>
          <div className="flex flex-col gap-3">
            {BUSIEST.map((r) => (
              <div key={r.route}>
                <div className="flex justify-between gap-3 text-[12.5px]">
                  <span className="truncate">{r.route}</span>
                  <Mono className="text-muted">{r.count}</Mono>
                </div>
                <ProgressBar pct={r.width} track="#eceef1" className="mt-1.5" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
