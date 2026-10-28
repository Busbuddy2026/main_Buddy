"use client";

import { notFound, useParams } from "next/navigation";
import { StopMapper } from "@/components/transport/stop-mapper";
import { BackLink } from "@/components/transport/ui";
import { useData } from "@/lib/transport/store";

/** Map a route's stops from a bus's real trip (pins, order, pickup and drop times). */
export default function MapStopsPage() {
  const { routeId } = useParams<{ routeId: string }>();
  const route = useData().routes.find((r) => r.id === routeId);
  if (!route) notFound();
  return (
    <div className="flex flex-col gap-[18px]">
      <BackLink href={`/admin/routes/${route.id}`}>{route.name}</BackLink>
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Map stops from a trip</h2>
        <p className="mt-1 text-[13px] text-muted">
          Put each stop where the bus really stops: pick a day the bus ran this route, then place or confirm each pin.
        </p>
      </div>
      <StopMapper routeId={route.id} />
    </div>
  );
}
