"use client";

import { useState } from "react";
import { Coverage, Kpi, PeriodPicker, rangeFor, type Period } from "@/components/transport/analytics-ui";
import { LoadingBlock } from "@/components/transport/skeleton";
import { Card, Mono, TableWrap, Td, Th } from "@/components/transport/ui";
import { useApi } from "@/lib/api/use-api";
import type { PunctualityReport } from "@/lib/api/types";
import { clockLabel, formatDay } from "@/lib/time";

/**
 * Punctuality: does the morning run reach school before the bell, when does
 * the bus really reach each stop (the usual time, from the tracker), and how
 * long does each child ride.
 */

const clock = (hhmm: string | null) => (hhmm ? clockLabel(hhmm) : "—");
const signedMin = (m: number | null) => (m == null ? "—" : m === 0 ? "on the bell" : m > 0 ? `${m} min late` : `${-m} min early`);

/** Minutes between a scheduled and a usual time: positive means later than scheduled. */
function drift(scheduled: string, usual: string | null): number | null {
  if (!usual) return null;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return toMin(usual) - toMin(scheduled);
}

export default function PunctualityPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const { from, to } = rangeFor(period);
  const res = useApi<PunctualityReport>(`/api/admin/analytics/punctuality?from=${from}&to=${to}`);
  const r = res.data;

  const runs = r?.buses.reduce((n, b) => n + b.days, 0) ?? 0;
  const onTime = r?.buses.reduce((n, b) => n + b.onTimeDays, 0) ?? 0;
  const longRides = r?.rides.filter((x) => Math.max(x.morningMin ?? 0, x.eveningMin ?? 0) > r.maxRideMin) ?? [];

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodPicker value={period} onChange={setPeriod} />
        {r ? <Coverage days={r.coverage.days} withData={r.coverage.withData} onRebuilt={() => void res.reload()} /> : null}
      </div>

      {!r ? (
        <Card>{res.error ? <div className="px-5 py-8 text-center text-[12.5px] text-critical-text">{res.error}</div> : <LoadingBlock label="Checking arrivals…" />}</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <Kpi label="School bell" value={clock(r.bellTime)} note="Change in Settings → Trips" />
            <Kpi label="Reached school before the bell" value={runs ? `${Math.round((onTime / runs) * 100)}%` : "—"} note={`${onTime} of ${runs} morning runs`} tone={runs && onTime / runs < 0.9 ? "#c5221f" : undefined} />
            <Kpi label="Rides over the limit" value={String(longRides.length)} note={`longer than ${r.maxRideMin} min`} tone={longRides.length ? "#8f5b00" : undefined} />
            <Kpi label="Stops with a usual time" value={`${r.stops.filter((s) => s.usualPickup).length} / ${r.stops.length}`} note="from the last 20 school days" />
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-line-soft px-5 py-3.5 text-[13.5px] font-semibold">Arrival at school</div>
            <TableWrap minWidth={820}>
              <thead>
                <tr>
                  <Th>Bus</Th>
                  <Th align="right">Usually arrives</Th>
                  <Th align="right">On time</Th>
                  <Th align="right">Average</Th>
                  <Th>First pickup</Th>
                  <Th>Latest days</Th>
                </tr>
              </thead>
              <tbody>
                {r.buses.map((b) => (
                  <tr key={b.busId}>
                    <Td>
                      <Mono className="font-semibold">Bus {b.number}</Mono>
                      <div className="text-[11px] text-faint">{b.route ?? "No route"}</div>
                    </Td>
                    <Td align="right"><Mono>{clock(b.typicalArrival)}</Mono></Td>
                    <Td align="right">
                      <Mono style={b.onTimePct != null && b.onTimePct < 90 ? { color: "#c5221f" } : undefined}>{b.onTimePct == null ? "—" : `${b.onTimePct}%`}</Mono>
                      <div className="text-[11px] text-faint"><Mono>{b.onTimeDays}</Mono> of <Mono>{b.days}</Mono> days</div>
                    </Td>
                    <Td align="right"><Mono>{signedMin(b.avgLateMin)}</Mono></Td>
                    <Td>
                      {b.firstStop ? (
                        <>
                          <div className="text-[12.5px]">{b.firstStop.name}</div>
                          <Mono className="text-[11.5px] text-faint">
                            planned {clock(b.firstStop.scheduled)} · usually {clock(b.firstStop.usual)}
                          </Mono>
                        </>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </Td>
                    <Td>
                      {b.latest.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {b.latest.map((l) => (
                            <span key={l.date} className="rounded-pill bg-critical-tint px-2 py-0.5 text-[11px] text-critical-text">
                              <Mono>{formatDay(l.date).replace(/ \d{4}$/, "")} · {clock(l.arrival)} (+{l.lateMin})</Mono>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[12px] text-success-text">No late days</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>

          <div className="grid gap-[18px] xl:grid-cols-2">
            <Card className="overflow-hidden">
              <div className="border-b border-line-soft px-5 py-3.5">
                <div className="text-[13.5px] font-semibold">Usual time at each stop</div>
                <div className="text-[11.5px] text-faint">Planned times against when the bus really gets there (median of the last 20 days).</div>
              </div>
              <TableWrap minWidth={520}>
                <thead>
                  <tr>
                    <Th>Stop</Th>
                    <Th align="right">Pickup</Th>
                    <Th align="right">Drop</Th>
                  </tr>
                </thead>
                <tbody>
                  {r.stops.length === 0 ? (
                    <tr>
                      <Td colSpan={3} className="py-8 text-center text-faint">No stops on a route yet.</Td>
                    </tr>
                  ) : null}
                  {r.stops.map((s) => {
                    const dp = drift(s.scheduledPickup, s.usualPickup);
                    const dd = drift(s.scheduledDrop, s.usualDrop);
                    return (
                      <tr key={`${s.bus}${s.stopId}`}>
                        <Td>
                          <div className="text-[12.5px] font-medium"><Mono className="text-faint">{s.seq}.</Mono> {s.name}</div>
                          <div className="text-[11px] text-faint">Bus {s.bus}</div>
                        </Td>
                        <Td align="right">
                          <Mono className="text-[12.5px]">usually {clock(s.usualPickup)}</Mono>
                          <div className="text-[11px] text-faint">
                            planned <Mono>{clock(s.scheduledPickup)}</Mono>
                            {dp != null && Math.abs(dp) >= 5 ? <Mono className="ml-1 text-warning-text">({dp > 0 ? "+" : ""}{dp})</Mono> : null}
                          </div>
                        </Td>
                        <Td align="right">
                          <Mono className="text-[12.5px]">usually {clock(s.usualDrop)}</Mono>
                          <div className="text-[11px] text-faint">
                            planned <Mono>{clock(s.scheduledDrop)}</Mono>
                            {dd != null && Math.abs(dd) >= 5 ? <Mono className="ml-1 text-warning-text">({dd > 0 ? "+" : ""}{dd})</Mono> : null}
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b border-line-soft px-5 py-3.5">
                <div className="text-[13.5px] font-semibold">Longest rides</div>
                <div className="text-[11.5px] text-faint">
                  From the child&apos;s stop to school, and back. Over <Mono>{r.maxRideMin}</Mono> min is flagged.
                </div>
              </div>
              <TableWrap minWidth={520}>
                <thead>
                  <tr>
                    <Th>Child</Th>
                    <Th>Stop</Th>
                    <Th align="right">Morning</Th>
                    <Th align="right">Evening</Th>
                  </tr>
                </thead>
                <tbody>
                  {r.rides.length === 0 ? (
                    <tr>
                      <Td colSpan={4} className="py-8 text-center text-faint">Ride times appear once stops have map pins and a few days of trips.</Td>
                    </tr>
                  ) : null}
                  {r.rides.slice(0, 40).map((x) => (
                    <tr key={x.studentId}>
                      <Td>
                        <div className="text-[12.5px] font-medium">{x.name}</div>
                        <div className="text-[11px] text-faint">{x.cls} · Bus {x.bus}</div>
                      </Td>
                      <Td><span className="text-[12px]">{x.stop ?? "—"}</span></Td>
                      {[x.morningMin, x.eveningMin].map((m, i) => (
                        <Td key={i} align="right">
                          <Mono className="text-[12.5px]" style={m != null && m > r.maxRideMin ? { color: "#c5221f", fontWeight: 600 } : undefined}>
                            {m == null ? "—" : `${m} min`}
                          </Mono>
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
