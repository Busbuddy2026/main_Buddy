"use client";

import { LoadingBlock } from "@/components/transport/skeleton";
import { Card, Icon, Mono, SecondaryButton, StatusPill, TableWrap, Td, Th } from "@/components/transport/ui";
import { api, errorMessage } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import type { FleetHealthReport } from "@/lib/api/types";
import { formatDay } from "@/lib/time";
import { useAdmin } from "@/lib/transport/admin-store";
import { useStore } from "@/lib/transport/store";
import { pill } from "@/lib/transport/tone";
import { useBusy } from "@/lib/use-busy";

/**
 * Fleet health over the last 30 days: how full and how busy each bus is,
 * when it is due a service (km since the last one, from the tracker), and
 * suggestions for the routes from how the buses actually run.
 */

const SERVICE = {
  ok: ["Not due", "good"],
  "due-soon": ["Due soon", "delayed"],
  overdue: ["Overdue", "bad"],
  unknown: ["Last service not recorded", "offline"],
} as const;

const SUGGESTION_ICON = { "few-riders": "group_off", "often-skipped": "wrong_location", order: "swap_vert" } as const;

export default function FleetHealthPage() {
  const res = useApi<FleetHealthReport>("/api/admin/analytics/fleet");
  const r = res.data;
  const { canEdit } = useAdmin();
  const { dispatch } = useStore();
  const { busy, run } = useBusy();

  const serviced = (busId: string, number: string) =>
    run(busId, async () => {
      try {
        await api.post("/api/admin/analytics/service", { busId });
        dispatch({ type: "toast", message: `Bus ${number} marked as serviced today.` });
        await res.reload();
      } catch (error) {
        dispatch({ type: "toast", message: errorMessage(error) });
      }
    });

  if (!r) return <Card>{res.error ? <div className="px-5 py-8 text-center text-[12.5px] text-critical-text">{res.error}</div> : <LoadingBlock label="Checking the fleet…" />}</Card>;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="text-[12px] text-faint">
        Last 30 days · <Mono>{formatDay(r.from)}</Mono> to <Mono>{formatDay(r.to)}</Mono>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line-soft px-5 py-3.5">
          <div className="text-[13.5px] font-semibold">Bus usage and servicing</div>
          <div className="text-[11.5px] text-faint">Seats filled, days on the road and km since the last service. Set each bus&apos;s service interval and last service in the bus form.</div>
        </div>
        <TableWrap minWidth={960}>
          <thead>
            <tr>
              <Th>Bus</Th>
              <Th align="right">Seats filled</Th>
              <Th align="right">Days used</Th>
              <Th align="right">km / day</Th>
              <Th align="right">Engine h / day</Th>
              <Th>Service</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {r.usage.map((b) => {
              const [label, kind] = SERVICE[b.service.state];
              return (
                <tr key={b.busId}>
                  <Td>
                    <Mono className="font-semibold">Bus {b.number}</Mono>
                    {b.underused ? <div className="text-[11px] text-warning-text">Underused</div> : !b.tracked ? <div className="text-[11px] text-faint">No GPS tracker</div> : null}
                  </Td>
                  <Td align="right">
                    <Mono>{b.riders} / {b.capacity}</Mono>
                    <div className="text-[11px] text-faint"><Mono>{b.fillPct}%</Mono></div>
                  </Td>
                  <Td align="right">
                    <Mono>{b.daysUsed} / {b.openDays}</Mono>
                    <div className="text-[11px] text-faint"><Mono>{b.usedPct}%</Mono></div>
                  </Td>
                  <Td align="right"><Mono>{b.kmPerDay}</Mono></Td>
                  <Td align="right"><Mono>{b.engineHoursPerDay}</Mono></Td>
                  <Td>
                    <StatusPill pill={pill(label, kind)} />
                    <div className="mt-1 text-[11px] text-faint">
                      {b.service.kmSince == null ? (
                        <>every <Mono>{b.serviceEveryKm.toLocaleString("en-IN")}</Mono> km</>
                      ) : (
                        <>
                          <Mono>{b.service.kmSince.toLocaleString("en-IN")}</Mono> km since <Mono>{formatDay(b.lastServiceOn!)}</Mono>
                          {b.service.dueInKm != null && b.service.dueInKm > 0 ? <> · due in <Mono>{b.service.dueInKm.toLocaleString("en-IN")}</Mono> km</> : null}
                        </>
                      )}
                    </div>
                  </Td>
                  <Td align="right">
                    {canEdit ? (
                      <SecondaryButton icon="build" loading={busy === b.busId} onClick={() => void serviced(b.busId, b.number)} className="!py-1.5 !text-[12px]">
                        Mark serviced today
                      </SecondaryButton>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line-soft px-5 py-3.5">
          <div className="text-[13.5px] font-semibold">Route suggestions</div>
          <div className="text-[11.5px] text-faint">From how the buses really ran. Suggestions only: nothing changes until you edit the route.</div>
        </div>
        {r.suggestions.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12.5px] text-faint">Nothing to suggest yet. Suggestions appear once stops have map pins and a few days of trips.</div>
        ) : (
          <ul>
            {r.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-3 border-b border-line-rule px-5 py-3 last:border-b-0">
                <Icon name={SUGGESTION_ICON[s.kind]} size={18} className="mt-0.5 text-muted" />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold tracking-[0.02em] text-faint">{s.route.toUpperCase()}</div>
                  <div className="text-[12.5px] text-ink-2">{s.text}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
