"use client";

import Link from "next/link";
import { useState } from "react";
import { DashcamModal } from "@/components/transport/dashcam-modal";
import { Card, Icon, Mono, StatusPill } from "@/components/transport/ui";
import { CCTV_LIVE_ROLES } from "@/lib/api/policy";
import { useApi } from "@/lib/api/use-api";
import { usePoll } from "@/lib/api/use-poll";
import type { BusLive, BusTrip, BusTrips, TrackerAlertRow } from "@/lib/api/types";
import { addDays, formatDay, formatTime, localDate } from "@/lib/time";
import { pill } from "@/lib/transport/tone";
import { useAdmin } from "@/lib/transport/admin-store";
import { ago, liveLabel } from "@/lib/transport/use-live";

/**
 * The selected bus on the live map: Overview (crew, position, next stop),
 * Route (today's trips A, B, … with the stops the tracker recorded; picking
 * one draws it on the map) and Alerts (the tracker's recent alerts).
 */

const TABS = ["Overview", "Route", "Alerts"] as const;
type Tab = (typeof TABS)[number];

const clock = (iso: string) => formatTime(new Date(iso));

function length(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] text-faint">{label}</div>
      <div className={`text-[13px] font-medium ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function Overview({ bus }: { bus: BusLive }) {
  const { user } = useAdmin();
  const [watching, setWatching] = useState(false);
  // The dashcam opens here, over the map; roles without live CCTV go to the CCTV page instead.
  const canWatch = bus.channels > 0 && CCTV_LIVE_ROLES.includes(user.role);
  return (
    <>
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-[11px] px-4 py-3">
        <Fact label="DRIVER" value={bus.driver ?? "—"} />
        <Fact label="ATTENDANT" value={bus.attendant ?? "—"} />
        <Fact label="ONBOARD" value={`${bus.trip?.onboard ?? 0} / ${bus.capacity}`} mono />
        <Fact label="SPEED" value={bus.fix ? `${bus.fix.speed} km/h` : "—"} mono />
        <Fact label="IGNITION" value={bus.fix?.ignition == null ? "—" : bus.fix.ignition ? "On" : "Off"} />
        <Fact label="HEADING" value={bus.fix?.heading == null ? "—" : `${Math.round(bus.fix.heading)}°`} mono />
        <Fact label="GPS" value={!bus.linked ? "Not linked" : bus.fix ? `Fix ${ago(bus.fix.ageMin)}` : "No fix yet"} />
        <Fact label="CAMERAS" value={bus.camerasTotal ? `${bus.camerasOnline} / ${bus.camerasTotal} live` : "None"} />
      </div>
      {bus.fix?.address ? <div className="px-4 pb-2 text-[11.5px] leading-[1.45] text-faint">{bus.fix.address}</div> : null}
      <div className="px-4 pb-3.5">
        <div className="flex items-center justify-between rounded-control bg-canvas px-3 py-2.5">
          <span className="min-w-0 truncate text-xs text-muted">
            {bus.trip?.nextStop ? `Next: ${bus.trip.nextStop.name} · ${bus.trip.nextStop.distanceKm} km` : bus.trip ? "On trip" : "No school trip running"}
          </span>
          <Mono className="text-sm font-semibold text-primary">{bus.trip?.nextStop ? `${bus.trip.nextStop.etaMin} min` : "—"}</Mono>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-[7px] px-4 pb-4">
        <Link href={`/admin/buses/${bus.number}`} className="rounded-[9px] border border-line py-[9px] text-center text-xs font-semibold text-ink-2 hover:bg-canvas">
          Bus
        </Link>
        <Link href="/admin/students" className="rounded-[9px] border border-line py-[9px] text-center text-xs font-semibold text-ink-2 hover:bg-canvas">
          Students
        </Link>
        {canWatch ? (
          <button
            type="button"
            onClick={() => setWatching(true)}
            className="inline-flex items-center justify-center gap-1 rounded-[9px] bg-primary py-[9px] text-xs font-semibold text-white hover:bg-primary-hover"
          >
            <Icon name="videocam" size={15} />
            Live CCTV
          </button>
        ) : (
          <Link href="/admin/cctv" className="rounded-[9px] bg-primary py-[9px] text-center text-xs font-semibold text-white hover:bg-primary-hover">
            CCTV
          </Link>
        )}
      </div>
      {watching ? <DashcamModal busUid={bus.busId} title={`Bus ${bus.number}`} onClose={() => setWatching(false)} /> : null}
    </>
  );
}

function TripCard({ trip, shown, onPick }: { trip: BusTrip; shown: boolean; onPick: () => void }) {
  // A running trip can be paused at a stop that has not yet lasted long enough to end it.
  const waiting = trip.running ? trip.stops.find((s) => s.end === null) : undefined;
  return (
    <div className="rounded-xl border" style={{ borderColor: shown ? "#1a73e8" : "#e4e7eb", background: shown ? "#f7faff" : "#fff" }}>
      <button type="button" onClick={onPick} aria-pressed={shown} className="block w-full p-3 text-left">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold">{trip.label}</span>
          {waiting ? (
            <StatusPill pill={pill(`At a stop · ${length(waiting.durationS)}`, "offline")} />
          ) : trip.running ? (
            <StatusPill pill={pill("Running", "ontime")} />
          ) : null}
          <Mono className="ml-auto text-[12px] text-muted">{trip.distanceKm} km</Mono>
        </div>
        <Mono className="mt-1 block text-[12px] text-ink-2">
          {clock(trip.start)} – {trip.end ? clock(trip.end) : "now"} · {length(trip.durationS)}
        </Mono>
        <div className="mt-1 truncate text-[11.5px] text-faint">
          {trip.from ?? "Start"} → {trip.to ?? (trip.running ? "on the way" : "End")}
        </div>
        <div className="mt-1 text-[11.5px] text-muted">
          {trip.stops.length ? `${trip.stops.length} stop${trip.stops.length === 1 ? "" : "s"}` : "No stops on the way"}
        </div>
      </button>
      {trip.missed.length ? (
        <div className="mx-3 mb-3 rounded-control bg-warning-tint px-3 py-2 text-[11.5px] text-warning-text">
          <div className="flex items-center gap-1.5 font-semibold">
            <Icon name="warning" size={15} />
            Didn&apos;t stop at {trip.missed.length} stop{trip.missed.length === 1 ? "" : "s"}
          </div>
          <ul className="mt-1 flex flex-col gap-0.5">
            {trip.missed.map((m) => (
              <li key={m.stopId}>
                {m.name}:{" "}
                {m.status === "passed" && m.at ? (
                  <>
                    drove past at <Mono>{clock(m.at)}</Mono>
                  </>
                ) : (
                  "not on the road taken"
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {shown && trip.stops.length ? (
        <ol className="border-t border-line-soft px-3 py-2.5">
          {trip.stops.map((s, i) => (
            <li key={s.start} className="flex gap-2.5 py-1.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ink font-mono text-[10.5px] font-semibold text-white">{i + 1}</span>
              <div className="min-w-0">
                <Mono className="block text-[12px] text-ink-2">
                  {s.end ? `${clock(s.start)} – ${clock(s.end)}` : `Since ${clock(s.start)}`} · {length(s.durationS)}
                </Mono>
                {s.address ? <div className="text-[11.5px] leading-[1.4] text-faint">{s.address}</div> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function RouteTab({ bus, shownKey, onPick }: { bus: BusLive; shownKey: string | null; onPick: (trip: BusTrip) => void }) {
  const res = useApi<BusTrips>(bus.linked ? `/api/admin/telematics/${bus.busId}/trips` : null);
  usePoll(res.reload, 60_000);
  if (!bus.linked) return <div className="px-4 py-8 text-center text-[12.5px] text-faint">No GPS tracker linked to this bus.</div>;
  if (!res.data) return <div className="px-4 py-8 text-center text-[12.5px] text-faint">{res.error || "Loading trips…"}</div>;
  if (!res.data.trips.length) return <div className="px-4 py-8 text-center text-[12.5px] text-faint">No trips yet today.</div>;
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="px-1 text-[11px] text-faint">Today · from the tracker. A stop of 30 min or more ends a trip.</div>
      {res.data.trips.map((t) => (
        <TripCard key={t.key} trip={t} shown={t.label === shownKey} onPick={() => onPick(t)} />
      ))}
    </div>
  );
}

function AlertsTab({ bus }: { bus: BusLive }) {
  const to = localDate();
  const res = useApi<{ items: TrackerAlertRow[] }>(bus.linked ? `/api/admin/telematics/${bus.busId}/alerts?from=${addDays(to, -6)}&to=${to}` : null);
  usePoll(res.reload, 60_000);
  if (!bus.linked) return <div className="px-4 py-8 text-center text-[12.5px] text-faint">No GPS tracker linked to this bus.</div>;
  if (!res.data) return <div className="px-4 py-8 text-center text-[12.5px] text-faint">{res.error || "Loading alerts…"}</div>;
  if (!res.data.items.length) return <div className="px-4 py-8 text-center text-[12.5px] text-faint">No tracker alerts in the last 7 days.</div>;
  return (
    <div>
      <ul>
        {res.data.items.slice(0, 30).map((a) => (
          <li key={a.id} className="border-b border-line-rule px-4 py-2.5 last:border-b-0">
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 text-[13px] font-medium text-ink">{a.label}</span>
              <Mono className="shrink-0 text-[11px] text-faint">
                {formatDay(new Date(a.at)).replace(/ \d{4}$/, "")} · {clock(a.at)}
              </Mono>
            </div>
            {a.description ? <div className="mt-0.5 text-[11.5px] text-muted">{a.description}</div> : null}
            {a.incident ? (
              <Link href={`/admin/incidents/${a.incident.id}`} className="mt-0.5 inline-block font-mono text-[11.5px] font-semibold text-primary">
                {a.incident.code ?? "Incident"}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
      <Link href={`/admin/buses/${bus.number}`} className="block border-t border-line-soft px-4 py-2.5 text-center text-[12px] font-semibold text-primary">
        All alerts on the bus page
      </Link>
    </div>
  );
}

export function LiveBusPanel({
  bus,
  shownTrip,
  onPickTrip,
}: {
  bus: BusLive;
  /** Label of the trip drawn on the map for this bus ("Trip B"), if any. */
  shownTrip: string | null;
  onPickTrip: (trip: BusTrip) => void;
}) {
  const [tab, setTab] = useState<Tab>("Overview");
  const status = liveLabel(bus);

  return (
    <Card className="flex min-h-0 shrink-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-line-soft px-4 py-[13px]">
        <Mono className="text-[15px] font-semibold tracking-[-0.015em]">Bus {bus.number}</Mono>
        <StatusPill pill={pill(status.label, status.kind)} />
      </div>
      <div role="tablist" className="grid grid-cols-3 gap-1 border-b border-line-soft p-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-chip py-[7px] text-[12.5px] font-semibold transition-colors ${tab === t ? "bg-primary text-white" : "text-muted hover:bg-canvas"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="max-h-[440px] min-h-0 overflow-auto">
        {tab === "Overview" ? <Overview bus={bus} /> : null}
        {tab === "Route" ? <RouteTab bus={bus} shownKey={shownTrip} onPick={onPickTrip} /> : null}
        {tab === "Alerts" ? <AlertsTab bus={bus} /> : null}
      </div>
    </Card>
  );
}
