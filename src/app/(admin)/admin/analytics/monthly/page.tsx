"use client";

import { useState } from "react";
import { hm, Kpi, num, rupees } from "@/components/transport/analytics-ui";
import { LoadingBlock } from "@/components/transport/skeleton";
import { Card, Mono, PrimaryButton, TableWrap, Td, Th } from "@/components/transport/ui";
import { useApi } from "@/lib/api/use-api";
import type { EfficiencyReport, PunctualityReport, SafetyReport } from "@/lib/api/types";
import { addDays, localDate } from "@/lib/time";
import { useAdmin } from "@/lib/transport/admin-store";

/**
 * One page per month for management: distance, estimated fuel and cost,
 * idling, punctuality and driver safety, per bus. "Download PDF" is the
 * browser's own print to PDF; the console's sidebar and header are left out.
 */

function monthRange(month: string) {
  const from = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
  const today = localDate();
  return { from, to: last < today ? last : today };
}

const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

export default function MonthlyReportPage() {
  const { user } = useAdmin();
  const thisMonth = localDate().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const { from, to } = monthRange(month);
  const q = `from=${from}&to=${to}`;
  const eff = useApi<EfficiencyReport>(`/api/admin/analytics/efficiency?${q}`);
  const safe = useApi<SafetyReport>(`/api/admin/analytics/safety?${q}`);
  const punct = useApi<PunctualityReport>(`/api/admin/analytics/punctuality?${q}`);
  const e = eff.data;
  const s = safe.data;
  const p = punct.data;
  const ready = e && s && p;

  const months = Array.from({ length: 12 }, (_, i) => addDays(`${thisMonth}-01`, -31 * i).slice(0, 7)).filter((m, i, all) => all.indexOf(m) === i);
  const runs = p?.buses.reduce((n, b) => n + b.days, 0) ?? 0;
  const onTime = p?.buses.reduce((n, b) => n + b.onTimeDays, 0) ?? 0;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <select
          aria-label="Month"
          value={month}
          onChange={(ev) => setMonth(ev.target.value)}
          className="rounded-control border border-line bg-surface px-3 py-2 text-[13px]"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <PrimaryButton icon="picture_as_pdf" disabled={!ready} onClick={() => window.print()}>
          Download PDF
        </PrimaryButton>
      </div>

      {!ready ? (
        <Card>
          <LoadingBlock label="Putting the month together…" />
        </Card>
      ) : (
        <div className="flex flex-col gap-[18px]">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Transport report · {monthLabel(month)}</h1>
            <div className="mt-0.5 text-[12.5px] text-muted">
              {user.school.name} · <Mono>{from}</Mono> to <Mono>{to}</Mono> · data for <Mono>{e.coverage.withData}</Mono> of <Mono>{e.coverage.days}</Mono> days
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            <Kpi label="Distance" value={`${num(e.totals.km, 0)} km`} />
            <Kpi label="Fuel cost (estimated)" value={rupees(e.totals.costRs)} note={`${num(e.totals.fuelL, 0)} L at ${rupees(e.dieselPriceRs)}/L`} />
            <Kpi label="Idling" value={hm(e.totals.idleS)} note={`${e.totals.idlePct}% of engine time · ≈ ${rupees(e.totals.idleCostRs)}`} />
            <Kpi label="Reached school before the bell" value={runs ? `${Math.round((onTime / runs) * 100)}%` : "—"} note={`${onTime} of ${runs} mornings · bell ${p.bellTime}`} />
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-line-soft px-5 py-3 text-[13.5px] font-semibold">Per bus</div>
            <TableWrap minWidth={760}>
              <thead>
                <tr>
                  <Th>Bus</Th>
                  <Th align="right">Days</Th>
                  <Th align="right">Distance</Th>
                  <Th align="right">Idling</Th>
                  <Th align="right">Fuel cost</Th>
                  <Th align="right">Per child</Th>
                  <Th align="right">On time</Th>
                </tr>
              </thead>
              <tbody>
                {e.buses.map((b) => {
                  const pb = p.buses.find((x) => x.busId === b.busId);
                  return (
                    <tr key={b.busId}>
                      <Td><Mono className="font-semibold">Bus {b.number}</Mono></Td>
                      <Td align="right"><Mono>{b.days}</Mono></Td>
                      <Td align="right"><Mono>{num(b.km, 0)} km</Mono></Td>
                      <Td align="right"><Mono>{hm(b.idleS)} ({b.idlePct}%)</Mono></Td>
                      <Td align="right"><Mono>{rupees(b.costRs)}</Mono></Td>
                      <Td align="right"><Mono>{rupees(b.costPerChild)}</Mono></Td>
                      <Td align="right"><Mono>{pb?.onTimePct == null ? "—" : `${pb.onTimePct}%`}</Mono></Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line-soft px-5 py-3 text-[13.5px] font-semibold">Drivers</div>
            <TableWrap minWidth={760}>
              <thead>
                <tr>
                  <Th>Driver</Th>
                  <Th align="right">Score</Th>
                  <Th align="right">Overspeed</Th>
                  <Th align="right">Harsh / ADAS</Th>
                  <Th align="right">Missed stops</Th>
                  <Th align="right">After hours</Th>
                  <Th align="right">Off route</Th>
                </tr>
              </thead>
              <tbody>
                {s.drivers.map((d) => (
                  <tr key={d.driverId ?? "none"}>
                    <Td>
                      {d.name}
                      <div className="text-[11px] text-faint">{d.buses.map((b) => `Bus ${b}`).join(", ") || "No bus"}</div>
                    </Td>
                    <Td align="right"><Mono className="font-semibold">{d.score}</Mono></Td>
                    <Td align="right"><Mono>{d.overspeedEvents}</Mono></Td>
                    <Td align="right"><Mono>{d.harshEvents}</Mono></Td>
                    <Td align="right"><Mono>{d.missedStops}</Mono></Td>
                    <Td align="right"><Mono>{d.afterHours}</Mono></Td>
                    <Td align="right"><Mono>{d.offRoute}</Mono></Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>

          <div className="text-[11px] text-faint">
            Fuel and cost are estimates from distance, idling time, each bus&apos;s mileage and the diesel price in Settings; the buses have no fuel sensor.
            Generated {new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}.
          </div>
        </div>
      )}
    </div>
  );
}
