"use client";

import { Card, Mono, ProgressBar } from "@/components/transport/ui";
import { useApi } from "@/lib/api/use-api";
import type { overview } from "@/server/services/analytics";
import { duration } from "@/components/transport/telematics";
import type { FleetTelematicsRow } from "@/lib/api/types";

type Overview = Awaited<ReturnType<typeof overview>>;

const signed = (n: number, unit = "") => `${n > 0 ? "+" : ""}${n}${unit}`;

/** Transport analytics for the last 30 days, from GET /api/admin/analytics. */
export default function AnalyticsPage() {
  const { data } = useApi<Overview>("/api/admin/analytics?days=30");
  const fleet = useApi<FleetTelematicsRow[]>("/api/admin/analytics/telematics");
  const k = data?.kpis;

  const KPIS = [
    {
      label: "Trips completed",
      value: k ? k.trips.toLocaleString("en-IN") : "—",
      delta: k?.tripDelta == null ? "Last 30 days" : `${signed(Math.round(k.tripDelta * 10) / 10, "%")} vs previous 30 days`,
      deltaColor: k?.tripDelta != null && k.tripDelta < 0 ? "#8f5b00" : "#186c33",
    },
    {
      label: "On-time rate",
      value: k ? `${k.onTimeRate}%` : "—",
      delta: k?.onTimeDelta == null ? `Within ${data?.threshold ?? 5} min of schedule` : `${signed(k.onTimeDelta, " pts")}`,
      deltaColor: k?.onTimeDelta != null && k.onTimeDelta < 0 ? "#8f5b00" : "#186c33",
    },
    {
      label: "Average delay",
      value: k ? `${k.avgDelay} min` : "—",
      delta: k?.delayDelta == null ? "Per completed trip" : `${signed(k.delayDelta, " min")}`,
      deltaColor: k?.delayDelta != null && k.delayDelta > 0 ? "#8f5b00" : "#186c33",
    },
    { label: "Bus utilisation", value: k ? `${k.utilisation}%` : "—", delta: "Seats assigned to students", deltaColor: "#8b919b" },
  ];

  const bars = (data?.series ?? []).map((p) => ({
    height: `${Math.max(4, Math.round(((Math.max(p.value, 80) - 80) / 20) * 100))}%`,
    color: p.value >= 95 ? "#1a73e8" : p.value >= 90 ? "#8ab4f8" : "#f29900",
    label: p.label,
    value: p.value,
  }));

  const ATTENDANCE = data
    ? [
        { label: "Boarding rate", value: `${data.attendance.boardingRate}%`, width: `${data.attendance.boardingRate}%`, color: "#1e8e3e" },
        { label: "Absence rate", value: `${data.attendance.absenceRate}%`, width: `${data.attendance.absenceRate}%`, color: "#d93025" },
      ]
    : [];
  const SAFETY = (data?.safety ?? []).map(([label, value]) => [label, String(value)] as const);
  const BUSIEST = (data?.busiest ?? []).map((r) => ({ ...r, count: String(r.count) }));

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
              Percentage of trips completed within {data?.threshold ?? 5} minutes of schedule
            </div>
          </div>
          <div className="text-xs text-faint">Last 14 school days</div>
        </div>
        {data && bars.length === 0 ? (
          <div className="py-12 text-center text-[12.5px] text-faint">No completed trips yet.</div>
        ) : null}
        <div className="flex h-[180px] items-end gap-2.5">
          {bars.map((b, i) => (
            <div key={`${b.label}-${i}`} className="flex flex-1 flex-col items-center gap-2">
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

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
          <div>
            <div className="text-[13.5px] font-semibold">Fleet telematics · today</div>
            <div className="text-[11.5px] text-faint">From each bus&apos;s GPS tracker (LivePin daily report).</div>
          </div>
        </div>
        {fleet.data && fleet.data.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12.5px] text-faint">No bus has a GPS tracker linked yet.</div>
        ) : null}
        {(fleet.data ?? []).length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12.5px]">
              <thead className="text-[11px] text-faint">
                <tr>
                  {["Bus", "Tracker", "Distance", "Moving", "Engine on", "Idle", "Parked", "Max speed", "Overspeed"].map((h) => (
                    <th key={h} className="border-b border-line-rule px-5 py-2.5 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(fleet.data ?? []).map((row) => (
                  <tr key={row.bus}>
                    <td className="border-b border-line-rule px-5 py-2.5 font-mono font-semibold">{row.bus}</td>
                    <td className="border-b border-line-rule px-5 py-2.5 font-mono text-faint">{row.vehicleNo}</td>
                    {row.report ? (
                      <>
                        <td className="border-b border-line-rule px-5 py-2.5 font-mono">{row.report.distanceKm} km</td>
                        <td className="border-b border-line-rule px-5 py-2.5 font-mono">{duration(row.report.moving)}</td>
                        <td className="border-b border-line-rule px-5 py-2.5 font-mono">{duration(row.report.engineOn)}</td>
                        <td className="border-b border-line-rule px-5 py-2.5 font-mono">{duration(row.report.idle)}</td>
                        <td className="border-b border-line-rule px-5 py-2.5 font-mono">{duration(row.report.parked)}</td>
                        <td className="border-b border-line-rule px-5 py-2.5 font-mono">{row.report.maxSpeed} km/h</td>
                        <td className="border-b border-line-rule px-5 py-2.5 font-mono">{row.report.overspeedKm} km</td>
                      </>
                    ) : (
                      <td colSpan={7} className="border-b border-line-rule px-5 py-2.5 text-faint">{row.error ?? "No report yet today"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
