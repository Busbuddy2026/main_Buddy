"use client";

import Link from "next/link";
import { useState } from "react";
import { LiveMap } from "@/components/transport/live-map";
import {
  Card,
  FilterChip,
  Mono,
  SearchBox,
  StatusPill,
} from "@/components/transport/ui";
import { hit } from "@/lib/transport/derive";
import { BUS_TELEMETRY } from "@/lib/transport/seed";
import { useStore } from "@/lib/transport/store";
import { pill } from "@/lib/transport/tone";

const FLEET_FILTERS = ["All buses", "Active", "Delayed", "Offline"] as const;
type FleetFilter = (typeof FLEET_FILTERS)[number];

export default function LiveMapPage() {
  const { selectedBus, dispatch } = useStore();
  const [q, setQ] = useState("");
  const [fleet, setFleet] = useState<FleetFilter>("All buses");

  const bus = BUS_TELEMETRY[selectedBus] ?? BUS_TELEMETRY["12"];

  const rows = Object.values(BUS_TELEMETRY).filter((b) => {
    if (!hit(q, b.id, b.route, b.next)) return false;
    if (fleet === "All buses") return true;
    if (fleet === "Delayed") return b.kind === "delayed";
    if (fleet === "Offline") return b.kind === "offline";
    return b.kind === "ontime";
  });

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
        <span className="text-xs text-faint">Updated 4 seconds ago</span>
      </div>

      <div className="grid min-h-[560px] gap-4 xl:grid-cols-[minmax(0,1fr)_348px]">
        <div className="relative min-h-[520px] overflow-hidden rounded-card border border-line bg-[#e8eaed]">
          <LiveMap
            selected={selectedBus}
            onSelect={(id) => dispatch({ type: "selectBus", id })}
          />
          <div className="absolute left-4 top-4 z-[500] flex gap-2">
            <MapStat label="TRACKED" value="4 buses" />
            <MapStat label="ONBOARD" value="113" />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3.5">
          <Card className="shrink-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-[13px]">
              <Mono className="text-[15px] font-semibold tracking-[-0.015em]">Bus {bus.id}</Mono>
              <StatusPill pill={pill(bus.status, bus.kind)} />
            </div>
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-[11px] px-4 py-3">
              <Fact label="DRIVER" value={bus.driver} />
              <Fact label="ATTENDANT" value={bus.attendant} />
              <Fact label="ONBOARD" value={`${bus.students} / ${bus.cap}`} mono />
              <Fact label="SPEED" value={`${bus.speed} km/h`} mono />
              <Fact label="CURRENT STOP" value={bus.stop} />
              <Fact label="NEXT STOP" value={bus.next} />
              <Fact label="GPS" value={bus.gps} />
              <Fact label="CAMERAS" value={bus.cam} />
            </div>
            <div className="px-4 pb-3.5">
              <div className="flex items-center justify-between rounded-control bg-canvas px-3 py-2.5">
                <span className="text-xs text-muted">Estimated arrival at next stop</span>
                <Mono className="text-sm font-semibold text-primary">{bus.eta}</Mono>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-[7px] px-4 pb-4">
              <Link
                href={`/admin/buses/${bus.id}`}
                className="rounded-[9px] border border-line py-[9px] text-center text-xs font-semibold text-ink-2 hover:bg-canvas"
              >
                Trip
              </Link>
              <Link
                href="/admin/students"
                className="rounded-[9px] border border-line py-[9px] text-center text-xs font-semibold text-ink-2 hover:bg-canvas"
              >
                Students
              </Link>
              <Link
                href="/admin/cctv"
                className="rounded-[9px] bg-primary py-[9px] text-center text-xs font-semibold text-white hover:bg-primary-hover"
              >
                CCTV
              </Link>
            </div>
          </Card>

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
                const on = selectedBus === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => dispatch({ type: "selectBus", id: b.id })}
                    className="m-2 block w-[calc(100%-1rem)] rounded-xl border p-3 text-left"
                    style={{
                      borderColor: on ? "#1a73e8" : "#e4e7eb",
                      background: on ? "#f7faff" : "#fff",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Mono className="text-[13.5px] font-semibold">Bus {b.id}</Mono>
                      <StatusPill pill={pill(b.status, b.kind)} />
                    </div>
                    <div className="mt-1 text-xs text-muted">{b.route}</div>
                    <div className="mt-[7px] flex items-center gap-3 text-[11.5px] text-faint">
                      <Mono>
                        {b.students} / {b.cap}
                      </Mono>
                      <span className="min-w-0 truncate">Next: {b.next}</span>
                      <Mono className="ml-auto text-muted">{b.eta}</Mono>
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

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] text-faint">{label}</div>
      <div className={`text-[13px] font-medium ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
