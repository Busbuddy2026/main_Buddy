"use client";

import { useMemo, useState } from "react";
import { Coverage, hm, Kpi, num, PeriodPicker, rangeFor, rupees, type Period } from "@/components/transport/analytics-ui";
import { LoadingBlock } from "@/components/transport/skeleton";
import { SpotsMap } from "@/components/transport/spots-map";
import { Card, Mono, TableWrap, Td, Th } from "@/components/transport/ui";
import { useApi } from "@/lib/api/use-api";
import type { EfficiencyReport } from "@/lib/api/types";
import { formatDay, formatTime } from "@/lib/time";

/**
 * Fuel & idling: distance, engine time, how long buses stood with the engine
 * running, and what that costs. The buses have no fuel sensor, so fuel and
 * money are estimates from each bus's mileage and the school's diesel price.
 */
export default function EfficiencyPage() {
  const [period, setPeriod] = useState<Period>("7d");
  const { from, to } = rangeFor(period);
  const res = useApi<EfficiencyReport>(`/api/admin/analytics/efficiency?from=${from}&to=${to}`);
  const r = res.data;
  const [showStops, setShowStops] = useState(false);

  const waits = useMemo(() => (r?.idleEvents ?? []).filter((e) => showStops || !e.atStop), [r, showStops]);
  const spots = useMemo(
    () =>
      waits.map((e) => ({
        lat: e.lat,
        lng: e.lng,
        weight: e.durationS,
        color: e.atStop ? "#9aa0a6" : "#f29900",
        label: `Bus ${e.bus} · ${hm(e.durationS)}${e.atStop ? ` at ${e.atStop}` : ""}\n${formatDay(new Date(e.start))} · ${formatTime(new Date(e.start))} · ≈ ${rupees(e.costRs)}`,
      })),
    [waits],
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodPicker value={period} onChange={setPeriod} />
        {r ? <Coverage days={r.coverage.days} withData={r.coverage.withData} onRebuilt={() => void res.reload()} /> : null}
      </div>

      {!r ? (
        <Card>{res.error ? <div className="px-5 py-8 text-center text-[12.5px] text-critical-text">{res.error}</div> : <LoadingBlock label="Working out the fleet's days…" />}</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-6">
            <Kpi label="Distance" value={`${num(r.totals.km, 1)} km`} />
            <Kpi label="Engine on" value={hm(r.totals.engineOnS)} note={`moving ${hm(r.totals.movingS)}`} />
            <Kpi label="Idling (engine on, standing)" value={hm(r.totals.idleS)} note={`${r.totals.idlePct}% of engine time`} tone={r.totals.idlePct >= 25 ? "#c5221f" : undefined} />
            <Kpi label="Fuel (estimated)" value={`${num(r.totals.fuelL, 1)} L`} />
            <Kpi label="Fuel cost (estimated)" value={rupees(r.totals.costRs)} note={`diesel at ${rupees(r.dieselPriceRs)}/L`} />
            <Kpi label="Lost to idling (estimated)" value={rupees(r.totals.idleCostRs)} tone={r.totals.idleCostRs ? "#8f5b00" : undefined} />
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft px-5 py-3.5">
              <div className="text-[13.5px] font-semibold">Per bus</div>
              <div className="text-[11.5px] text-faint">Estimates use each bus&apos;s mileage and idling burn from the bus form.</div>
            </div>
            <TableWrap minWidth={1080}>
              <thead>
                <tr>
                  <Th>Bus</Th>
                  <Th align="right">Days</Th>
                  <Th align="right">Distance</Th>
                  <Th align="right">Engine on</Th>
                  <Th align="right">Idling</Th>
                  <Th align="right">Fuel</Th>
                  <Th align="right">km/L (est.)</Th>
                  <Th align="right">Cost</Th>
                  <Th align="right">Per km</Th>
                  <Th align="right">Per trip</Th>
                  <Th align="right">Per child</Th>
                </tr>
              </thead>
              <tbody>
                {r.buses.length === 0 ? (
                  <tr>
                    <Td colSpan={11} className="py-10 text-center text-faint">No bus has a GPS tracker linked.</Td>
                  </tr>
                ) : null}
                {r.buses.map((b) => (
                  <tr key={b.busId} className="hover:bg-[#fafbfc]">
                    <Td>
                      <Mono className="font-semibold">Bus {b.number}</Mono>
                      <div className="text-[11px] text-faint">
                        <Mono>{num(b.mileageKmpl, 1)}</Mono> km/L · idle <Mono>{num(b.idleLph, 1)}</Mono> L/h
                      </div>
                    </Td>
                    <Td align="right"><Mono>{b.days}</Mono></Td>
                    <Td align="right"><Mono>{num(b.km, 1)} km</Mono></Td>
                    <Td align="right"><Mono>{hm(b.engineOnS)}</Mono></Td>
                    <Td align="right">
                      <Mono style={b.idlePct >= 25 ? { color: "#c5221f" } : undefined}>{hm(b.idleS)}</Mono>
                      <div className="text-[11px] text-faint"><Mono>{b.idlePct}%</Mono> of engine time</div>
                    </Td>
                    <Td align="right"><Mono>{num(b.fuelL, 1)} L</Mono></Td>
                    <Td align="right"><Mono>{num(b.kmpl, 1)}</Mono></Td>
                    <Td align="right">
                      <Mono>{rupees(b.costRs)}</Mono>
                      {b.idleCostRs ? <div className="text-[11px] text-warning-text">idling <Mono>{rupees(b.idleCostRs)}</Mono></div> : null}
                    </Td>
                    <Td align="right"><Mono>{b.costPerKm == null ? "—" : `₹${num(b.costPerKm, 1)}`}</Mono></Td>
                    <Td align="right">
                      <Mono>{rupees(b.costPerTrip)}</Mono>
                      <div className="text-[11px] text-faint"><Mono>{b.trips}</Mono> trips</div>
                    </Td>
                    <Td align="right">
                      <Mono>{rupees(b.costPerChild)}</Mono>
                      <div className="text-[11px] text-faint"><Mono>{b.riders}</Mono> children</div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>

          <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-5 py-3.5">
                <div>
                  <div className="text-[13.5px] font-semibold">Long idling (5 min or more)</div>
                  <div className="text-[11.5px] text-faint">Engine running while the bus stood still. Waits at a route stop are usually children boarding.</div>
                </div>
                <label className="flex items-center gap-1.5 text-[12px] text-muted">
                  <input type="checkbox" checked={showStops} onChange={(e) => setShowStops(e.target.checked)} />
                  Include waits at stops
                </label>
              </div>
              {waits.length === 0 ? (
                <div className="px-5 py-10 text-center text-[12.5px] text-faint">No long idling in this period.</div>
              ) : (
                <ul className="max-h-[420px] overflow-auto">
                  {waits.map((e) => (
                    <li key={`${e.bus}-${e.start}`} className="flex items-center gap-3 border-b border-line-rule px-5 py-2.5 last:border-b-0">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: e.atStop ? "#9aa0a6" : "#f29900" }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium">
                          <Mono>Bus {e.bus}</Mono> · {e.atStop ? `at ${e.atStop}` : "not at a stop"}
                        </div>
                        <Mono className="text-[11.5px] text-faint">
                          {formatDay(new Date(e.start)).replace(/ \d{4}$/, "")} · {formatTime(new Date(e.start))}–{formatTime(new Date(e.end))}
                        </Mono>
                      </div>
                      <div className="text-right">
                        <Mono className="block text-[13px] font-semibold">{hm(e.durationS)}</Mono>
                        <Mono className="text-[11.5px] text-warning-text">≈ {rupees(e.costRs)}</Mono>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="relative min-h-[420px] overflow-hidden">
              {spots.length ? <SpotsMap spots={spots} /> : <div className="grid h-full min-h-[420px] place-items-center text-[12.5px] text-faint">Idle spots show here.</div>}
            </Card>
          </div>
          <div className="text-[11px] text-faint">
            Fuel and cost are estimates: distance ÷ the bus&apos;s mileage, plus idling time × its idling burn, at the diesel price in Settings. Change these in the
            bus form and Settings → Fuel and idling.
          </div>
        </>
      )}
    </div>
  );
}
