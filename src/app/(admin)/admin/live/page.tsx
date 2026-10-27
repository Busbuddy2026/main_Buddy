"use client";

import { useMemo, useState } from "react";
import { LiveBusPanel } from "@/components/transport/live-bus-panel";
import { LiveMap, toMapVehicles, type MapTrail } from "@/components/transport/live-map";
import {
  Card,
  FilterChip,
  Mono,
  SearchBox,
  StatusPill,
} from "@/components/transport/ui";
import type { BusTrip } from "@/lib/api/types";
import { hit } from "@/lib/transport/derive";
import { useStore } from "@/lib/transport/store";
import { pill } from "@/lib/transport/tone";
import { liveLabel, useLiveFleet, useTrails } from "@/lib/transport/use-live";

const FLEET_FILTERS = ["All buses", "Active", "Delayed", "Offline"] as const;
type FleetFilter = (typeof FLEET_FILTERS)[number];

export default function LiveMapPage() {
  const { selectedBus, dispatch } = useStore();
  const [q, setQ] = useState("");
  const [fleet, setFleet] = useState<FleetFilter>("All buses");

  const live = useLiveFleet();

  const liveTrails = useTrails();
  const buses = live.data?.buses ?? [];
  const bus = buses.find((b) => b.number === selectedBus) ?? buses.find((b) => b.fix) ?? buses[0];
  // A trip picked in the Route tab replaces that bus's running or last trip on the map.
  const [picked, setPicked] = useState<{ bus: string; trip: BusTrip } | null>(null);
  const pick = picked && picked.bus === bus?.number ? picked.trip : null;
  const trails = useMemo<MapTrail[]>(() => {
    if (!pick || !bus) return liveTrails;
    const chosen: MapTrail = { id: bus.number, points: pick.points, label: pick.label, faded: !pick.running, stops: pick.stops };
    return [...liveTrails.filter((t) => t.id !== bus.number), chosen];
  }, [liveTrails, pick, bus]);
  const shownTrip = trails.find((t) => t.id === bus?.number)?.label ?? null;

  const rows = buses.filter((b) => {
    if (!hit(q, b.number, b.route ?? "", b.trip?.nextStop?.name ?? "", b.vehicleNo ?? "")) return false;
    const kind = liveLabel(b).kind;
    if (fleet === "All buses") return true;
    if (fleet === "Delayed") return kind === "delayed";
    if (fleet === "Offline") return b.state === "offline" || b.state === "unlinked";
    return b.state === "moving" || b.state === "idle";
  });
  const tracked = buses.filter((b) => b.linked).length;
  const onboard = buses.reduce((t, b) => t + (b.trip?.onboard ?? 0), 0);
  const synced = live.data ? new Date(live.data.syncedAt) : null;

  const clear = () => {
    setQ("");
    setFleet("All buses");
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchBox value={q} onChange={setQ} placeholder="Search bus number" width={220} />
        {FLEET_FILTERS.map((f) => (
          <FilterChip key={f} label={f} active={fleet === f} onClick={() => setFleet(f)} />
        ))}
        <div className="flex-1" />
        <span className="text-xs text-faint">
          {synced ? `Updated ${synced.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" })} · refreshes every 15 s` : "Loading…"}
        </span>
      </div>

      <div className="grid min-h-[560px] gap-4 xl:grid-cols-[minmax(0,1fr)_348px]">
        <div className="relative min-h-[520px] overflow-hidden rounded-card border border-line bg-[#e8eaed]">
          <LiveMap
            trails={trails}
            vehicles={toMapVehicles(buses)}
            routes={live.data?.routes}
            selected={bus?.number}
            onSelect={(id) => dispatch({ type: "selectBus", id })}
          />
          <div className="absolute left-4 top-4 z-[500] flex gap-2">
            <MapStat label="TRACKED" value={`${tracked} of ${buses.length}`} />
            <MapStat label="ONBOARD" value={String(onboard)} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3.5">
          {bus ? (
            <LiveBusPanel key={bus.busId} bus={bus} shownTrip={shownTrip} onPickTrip={(trip) => setPicked({ bus: bus.number, trip })} />
          ) : null}

          <Card className="min-h-0 overflow-auto">
            <div className="sticky top-0 border-b border-line-soft bg-surface px-4 py-3 text-[13px] font-semibold">
              All buses
            </div>
            {rows.length === 0 ? (
              <div className="px-[18px] py-[34px] text-center">
                <div className="text-[13.5px] font-semibold text-muted">
                  No buses match these filters
                </div>
                <button
                  type="button"
                  onClick={clear}
                  className="mt-2.5 rounded-[9px] border border-line bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-primary hover:bg-canvas"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              rows.map((b) => {
                const on = bus?.number === b.number;
                const l = liveLabel(b);
                return (
                  <button
                    key={b.busId}
                    type="button"
                    onClick={() => dispatch({ type: "selectBus", id: b.number })}
                    className="m-2 block w-[calc(100%-1rem)] rounded-xl border p-3 text-left"
                    style={{
                      borderColor: on ? "#1a73e8" : "#e4e7eb",
                      background: on ? "#f7faff" : "#fff",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Mono className="text-[13.5px] font-semibold">Bus {b.number}</Mono>
                      <StatusPill pill={pill(l.label, l.kind)} />
                    </div>
                    <div className="mt-1 text-xs text-muted">{b.route ?? "No route"}</div>
                    <div className="mt-[7px] flex items-center gap-3 text-[11.5px] text-faint">
                      <Mono>
                        {b.trip?.onboard ?? 0} / {b.capacity}
                      </Mono>
                      <span className="min-w-0 truncate">{b.trip?.nextStop ? `Next: ${b.trip.nextStop.name}` : b.vehicleNo ?? ""}</span>
                      <Mono className="ml-auto text-muted">{b.trip?.nextStop ? `${b.trip.nextStop.etaMin} min` : b.fix ? `${b.fix.speed} km/h` : ""}</Mono>
                    </div>
                  </button>
                );
              })
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function MapStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-control border border-line bg-surface px-3 py-2"
      style={{ boxShadow: "0 2px 10px rgba(16,24,40,.08)" }}
    >
      <div className="text-[10.5px] tracking-[0.02em] text-faint">{label}</div>
      <Mono className="text-[15px] font-semibold">{value}</Mono>
    </div>
  );
}
