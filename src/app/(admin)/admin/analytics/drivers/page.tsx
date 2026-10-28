"use client";

import { useMemo, useState } from "react";
import { Coverage, hm, num, PeriodPicker, rangeFor, type Period } from "@/components/transport/analytics-ui";
import { LoadingBlock } from "@/components/transport/skeleton";
import { SpotsMap } from "@/components/transport/spots-map";
import { Card, Mono, ProgressBar, TableWrap, Td, Th } from "@/components/transport/ui";
import { useApi } from "@/lib/api/use-api";
import type { SafetyReport } from "@/lib/api/types";
import { formatDay, formatTime } from "@/lib/time";

/**
 * Driver safety: a score per driver from overspeeding, harsh driving, idling,
 * missed stops, after-hours use and detours (per day driven, so busier
 * drivers are not punished for driving more), where buses overspeed, and
 * every after-hours trip and detour.
 */

const scoreColor = (s: number) => (s >= 85 ? "#1e8e3e" : s >= 70 ? "#f29900" : "#d93025");
const when = (iso: string) => `${formatDay(new Date(iso)).replace(/ \d{4}$/, "")} · ${formatTime(new Date(iso))}`;
const hourLabel = (h: number) => formatTime(new Date(Date.UTC(2026, 0, 1, h, 0) - 330 * 60_000));

export default function DriverSafetyPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const { from, to } = rangeFor(period);
  const res = useApi<SafetyReport>(`/api/admin/analytics/safety?from=${from}&to=${to}`);
  const r = res.data;

  const spots = useMemo(
    () =>
      (r?.hotspots ?? []).map((h) => ({
        lat: h.lat,
        lng: h.lng,
        weight: h.count,
        color: h.topSpeed >= 70 ? "#d93025" : "#f29900",
        label: `${h.count} time${h.count === 1 ? "" : "s"} over the limit · top ${h.topSpeed} km/h\nmostly around ${hourLabel(h.hour)}`,
      })),
    [r],
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodPicker value={period} onChange={setPeriod} />
        {r ? <Coverage days={r.coverage.days} withData={r.coverage.withData} onRebuilt={() => void res.reload()} /> : null}
      </div>

      {!r ? (
        <Card>{res.error ? <div className="px-5 py-8 text-center text-[12.5px] text-critical-text">{res.error}</div> : <LoadingBlock label="Scoring drivers…" />}</Card>
      ) : (
        <>
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
            {r.drivers.map((d) => (
              <Card key={d.driverId ?? "none"} className="px-5 py-[18px]">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold">{d.name}</div>
                    <div className="text-[11.5px] text-faint">
                      {d.buses.length ? d.buses.map((b) => `Bus ${b}`).join(", ") : "No bus"} · <Mono>{d.days}</Mono> day{d.days === 1 ? "" : "s"} · <Mono>{num(d.km, 0)}</Mono> km
                    </div>
                  </div>
                  <Mono className="text-[24px] font-semibold" style={{ color: scoreColor(d.score) }}>
                    {d.score}
                  </Mono>
                </div>
                <ProgressBar pct={`${d.score}%`} color={scoreColor(d.score)} track="#eceef1" className="my-3.5" />
                <div className="grid grid-cols-3 gap-x-2.5 gap-y-2">
                  <Stat label="OVERSPEED" value={d.overspeedEvents} bad={d.overspeedEvents > 0} />
                  <Stat label="HARSH / ADAS" value={d.harshEvents} bad={d.harshEvents > 0} />
                  <Stat label="IDLING" value={hm(d.idleMin * 60)} />
                  <Stat label="MISSED STOPS" value={d.missedStops} bad={d.missedStops > 0} />
                  <Stat label="AFTER HOURS" value={d.afterHours} bad={d.afterHours > 0} />
                  <Stat label="OFF ROUTE" value={d.offRoute} bad={d.offRoute > 0} />
                </div>
              </Card>
            ))}
          </div>

          <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Card className="relative min-h-[380px] overflow-hidden">
              <div className="absolute left-3 top-3 z-[500] rounded-control border border-line bg-surface px-3 py-2">
                <div className="text-[12.5px] font-semibold">Overspeed hotspots</div>
                <div className="text-[11px] text-faint">Bigger circle: more often. Red: 70 km/h or more.</div>
              </div>
              {spots.length ? <SpotsMap spots={spots} /> : <div className="grid h-full min-h-[380px] place-items-center text-[12.5px] text-faint">No overspeeding in this period.</div>}
            </Card>
            <div className="flex flex-col gap-[18px]">
              <SpanList
                title="Used outside school hours"
                note="Moving outside the morning and evening runs (±1 h), or on a Sunday."
                empty="No after-hours use."
                rows={r.afterHours.map((s) => ({ key: `${s.bus}${s.start}`, bus: s.bus, driver: s.driver, start: s.start, end: s.end, detail: `${num(s.km, 1)} km` }))}
              />
              <SpanList
                title="Off route"
                note="More than 500 m from the mapped route during a run."
                empty="No detours."
                rows={r.offRoute.map((s) => ({ key: `${s.bus}${s.start}`, bus: s.bus, driver: s.driver, start: s.start, end: s.end, detail: `up to ${num(s.maxM / 1000, 1)} km away` }))}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, bad = false }: { label: string; value: number | string; bad?: boolean }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.03em] text-faint">{label}</div>
      <Mono className="text-[13.5px] font-semibold" style={bad ? { color: "#c5221f" } : undefined}>
        {value}
      </Mono>
    </div>
  );
}

function SpanList({ title, note, empty, rows }: { title: string; note: string; empty: string; rows: Array<{ key: string; bus: string; driver: string | null; start: string; end: string; detail: string }> }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line-soft px-5 py-3">
        <div className="text-[13.5px] font-semibold">{title}</div>
        <div className="text-[11.5px] text-faint">{note}</div>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-6 text-center text-[12.5px] text-faint">{empty}</div>
      ) : (
        <TableWrap minWidth={420}>
          <thead>
            <tr>
              <Th>Bus</Th>
              <Th>When</Th>
              <Th align="right">How far</Th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 30).map((s) => (
              <tr key={s.key}>
                <Td>
                  <Mono className="font-semibold">Bus {s.bus}</Mono>
                  <div className="text-[11px] text-faint">{s.driver ?? "No driver assigned"}</div>
                </Td>
                <Td>
                  <Mono className="text-[12px]">
                    {when(s.start)}–{formatTime(new Date(s.end))}
                  </Mono>
                </Td>
                <Td align="right">
                  <Mono className="text-[12px]">{s.detail}</Mono>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </Card>
  );
}
