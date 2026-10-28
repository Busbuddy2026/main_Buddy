"use client";

import { useCallback, useMemo, useState } from "react";
import { LiveBusPanel } from "@/components/transport/live-bus-panel";
import { LiveMap, MapLegend, toMapVehicles, type MapTrail } from "@/components/transport/live-map";
import { Card, FilterChip, Icon, Mono, SearchBox, StatusPill } from "@/components/transport/ui";
import type { BusLive, BusTrip } from "@/lib/api/types";
import { hit } from "@/lib/transport/derive";
import { useStore } from "@/lib/transport/store";
import { pill } from "@/lib/transport/tone";
import { ago, liveLabel, useLiveFleet, useTrails } from "@/lib/transport/use-live";

/**
 * Live Operations, the console's home: every bus on the map, and on the right
 * the list of buses (where each was last, engine on or off, how far from
 * school). Picking a bus opens its panel; its chosen trip drives the map.
 */

const FLEET_FILTERS = ["All buses", "Active", "Delayed", "Offline"] as const;
type FleetFilter = (typeof FLEET_FILTERS)[number];

export default function LiveMapPage() {
  const { selectedBus, dispatch } = useStore();
  const [q, setQ] = useState("");
  const [fleet, setFleet] = useState<FleetFilter>("All buses");

  const live = useLiveFleet();
  const liveTrails = useTrails();
  const buses = useMemo(() => live.data?.buses ?? [], [live.data]);
  const bus = buses.find((b) => b.number === selectedBus) ?? null;

  // The selected bus's chosen trip replaces its running or last trip on the map.
  const [picked, setPicked] = useState<{ bus: string; trip: BusTrip | null } | null>(null);
  const onTrip = useCallback((trip: BusTrip | null) => setPicked(bus ? { bus: bus.number, trip } : null), [bus]);
  const trip = picked && bus && picked.bus === bus.number ? picked.trip : null;
  const trails = useMemo<MapTrail[]>(() => {
    if (!bus) return liveTrails;
    if (!trip) return liveTrails.filter((t) => t.id === bus.number);
    return [
      {
        id: bus.number,
        points: trip.points,
        label: trip.label,
        faded: !trip.running,
        stops: trip.stops,
        alerts: trip.alerts,
        missed: trip.missed,
        ends: { start: trip.start, end: trip.end, from: trip.from, to: trip.to },
      },
    ];
  }, [liveTrails, trip, bus]);

  const rows = buses.filter((b) => {
    if (!hit(q, b.number, b.route ?? "", b.fix?.address ?? "", b.vehicleNo ?? "", b.driver ?? "")) return false;
    const kind = liveLabel(b).kind;
    if (fleet === "All buses") return true;
    if (fleet === "Delayed") return kind === "delayed";
    if (fleet === "Offline") return b.state === "offline" || b.state === "unlinked";
    return b.state === "moving" || b.state === "idle";
  });
  const tracked = buses.filter((b) => b.linked).length;
  const engineOn = buses.filter((b) => b.fix?.ignition === true).length;
  const synced = live.data ? new Date(live.data.syncedAt) : null;

  const select = (number: string) => dispatch({ type: "selectBus", id: number });

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchBox value={q} onChange={setQ} placeholder="Search bus, place or driver" width={240} />
        {FLEET_FILTERS.map((f) => (
          <FilterChip key={f} label={f} active={fleet === f} onClick={() => setFleet(f)} />
        ))}
        <div className="flex-1" />
        <span className="text-xs text-faint">
          {synced ? `Updated ${synced.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" })} · refreshes every 15 s` : "Loading…"}
        </span>
      </div>

      <div className="grid min-h-[600px] gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative min-h-[600px] overflow-hidden rounded-card border border-line bg-[#e8eaed]">
          <LiveMap
            trails={trails}
            vehicles={toMapVehicles(bus ? buses.filter((b) => b.number === bus.number) : buses)}
            routes={live.data?.routes}
            selected={bus?.number}
            focus={bus?.number}
            onSelect={select}
            school={live.data?.school}
          />
          <div className="absolute left-4 top-4 z-[500] flex gap-2">
            <MapStat label="TRACKED" value={`${tracked} of ${buses.length}`} />
            <MapStat label="ENGINE ON" value={String(engineOn)} />
          </div>
          <MapLegend trails={trails} className="absolute bottom-4 left-4 z-[500] max-w-[calc(100%-5rem)]" />
        </div>

        <div className="flex min-h-0 flex-col gap-3.5">
          {bus ? (
            <LiveBusPanel key={bus.busId} bus={bus} onBack={() => dispatch({ type: "selectBus", id: "" })} onTrip={onTrip} />
          ) : (
            <Card className="min-h-0 overflow-auto">
              <div className="sticky top-0 z-10 flex items-baseline justify-between border-b border-line-soft bg-surface px-4 py-3">
                <span className="text-[13px] font-semibold">Buses</span>
                <span className="text-[11.5px] text-faint">
                  {live.data?.school ? (live.data.school.source === "settings" ? "km from school" : "km from school (estimated)") : "Set the school location in Settings"}
                </span>
              </div>
              {rows.length === 0 ? (
                <div className="px-[18px] py-[34px] text-center text-[13px] text-muted">{live.data ? "No buses match these filters" : "Loading buses…"}</div>
              ) : (
                rows.map((b) => <BusRow key={b.busId} b={b} onPick={() => select(b.number)} />)
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function BusRow({ b, onPick }: { b: BusLive; onPick: () => void }) {
  const l = liveLabel(b);
  const on = b.fix?.ignition === true;
  return (
    <button type="button" onClick={onPick} className="m-2 block w-[calc(100%-1rem)] rounded-xl border border-line p-3 text-left hover:border-primary hover:bg-[#f7faff]">
      <div className="flex items-center justify-between gap-2">
        <Mono className="text-[13.5px] font-semibold">Bus {b.number}</Mono>
        <StatusPill pill={pill(l.label, l.kind)} />
      </div>
      <div className="mt-1.5 flex items-start gap-1.5 text-[12px] text-muted">
        <Icon name="location_on" size={15} className="mt-px shrink-0 text-faint" />
        <span className="line-clamp-2">{b.fix?.address ?? (b.linked ? "No position yet" : "No GPS tracker")}</span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11.5px]">
        <span className={`inline-flex items-center gap-1 font-semibold ${on ? "text-success-text" : "text-muted"}`}>
          <Icon name={on ? "power_settings_new" : "power_off"} size={14} />
          {b.fix?.ignition == null ? "Engine —" : on ? "Engine on" : "Engine off"}
        </span>
        <Mono className="text-muted">{b.fix ? `${b.fix.speed} km/h` : ""}</Mono>
        <span className="ml-auto inline-flex items-center gap-1 text-muted">
          <Icon name="school" size={14} className="text-faint" />
          <Mono>{b.kmFromSchool == null ? "—" : `${b.kmFromSchool} km`}</Mono>
        </span>
      </div>
      <div className="mt-1 text-[11px] text-faint">
        {b.route ?? "No route"} · {b.fix ? `seen ${ago(b.fix.ageMin)}` : "—"}
      </div>
    </button>
  );
}

function MapStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-line bg-surface px-3 py-2" style={{ boxShadow: "0 2px 10px rgba(16,24,40,.08)" }}>
      <div className="text-[10.5px] tracking-[0.02em] text-faint">{label}</div>
      <Mono className="text-[15px] font-semibold">{value}</Mono>
    </div>
  );
}
