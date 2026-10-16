"use client";

import Link from "next/link";
import { Card, Mono, StatusPill, Th, TableWrap, Td } from "@/components/transport/ui";
import { useStore } from "@/lib/transport/store";
import { pill } from "@/lib/transport/tone";
import { liveLabel, useLiveFleet } from "@/lib/transport/use-live";

/** Trips running now, with the next stop and ETA from GPS. */
export default function ActiveTripsPage() {
  const { dispatch } = useStore();
  const live = useLiveFleet();
  const trips = (live.data?.buses ?? []).filter((b) => b.trip);

  return (
    <Card className="overflow-hidden">
      <TableWrap minWidth={700}>
        <thead>
          <tr>
            <Th>Bus</Th>
            <Th>Route</Th>
            <Th>Trip</Th>
            <Th>Students</Th>
            <Th>Status</Th>
            <Th align="right">ETA</Th>
          </tr>
        </thead>
        <tbody>
          {live.data && trips.length === 0 ? (
            <tr>
              <Td colSpan={6} className="py-10 text-center text-faint">
                No trips running right now.
              </Td>
            </tr>
          ) : null}
          {trips.map((t) => {
            const l = liveLabel(t);
            return (
              <tr key={t.busId} className="cursor-pointer hover:bg-[#fafbfc]" onClick={() => dispatch({ type: "selectBus", id: t.number })}>
                <Td>
                  <Link href={`/admin/buses/${t.number}`} className="font-mono text-sm font-semibold text-ink">
                    Bus {t.number}
                  </Link>
                </Td>
                <Td>
                  <div className="text-[13.5px] font-medium text-ink">{t.route ?? "No route"}</div>
                  <div className="mt-0.5 text-[11.5px] text-faint">
                    {t.trip?.nextStop ? `Next: ${t.trip.nextStop.name} · ${t.trip.nextStop.distanceKm} km` : t.linked ? "Waiting for GPS" : "No GPS linked"}
                  </div>
                </Td>
                <Td className="capitalize">{t.trip?.phase}</Td>
                <Td>
                  <Mono className="text-[13px] text-ink-2">
                    {t.trip?.onboard ?? 0} / {t.capacity}
                  </Mono>
                </Td>
                <Td>
                  <StatusPill pill={pill(l.label, l.kind)} />
                </Td>
                <Td align="right">
                  <Mono className="text-[13px] text-muted">{t.trip?.nextStop ? `${t.trip.nextStop.etaMin} min` : "—"}</Mono>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </TableWrap>
    </Card>
  );
}
