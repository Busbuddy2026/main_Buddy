"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTimeline } from "@/components/transport/alert-timeline";
import { hm, num, rupees } from "@/components/transport/analytics-ui";
import { DashcamModal } from "@/components/transport/dashcam-modal";
import { LoadingBlock, Spinner } from "@/components/transport/skeleton";
import { Card, Icon, Mono, PrimaryButton, StatusPill } from "@/components/transport/ui";
import { api, errorMessage } from "@/lib/api/client";
import { CCTV_LIVE_ROLES } from "@/lib/api/policy";
import { useApi } from "@/lib/api/use-api";
import { usePoll } from "@/lib/api/use-poll";
import type { BusLive, BusTrip, BusTripDetail } from "@/lib/api/types";
import { addDays, clockLabel, formatDay, formatTime, localDate } from "@/lib/time";
import { useAdmin } from "@/lib/transport/admin-store";
import { pill } from "@/lib/transport/tone";
import { ago, liveLabel } from "@/lib/transport/use-live";

/**
 * The selected bus on the live map. A trip picker on top (today's latest trip
 * by default) drives everything below and the map: Overview (bus info, the
 * trip, its efficiency and the bus's last 30 days; the analytics behind the
 * Analytics PIN), Stops (what the bus did at each stop, and its children),
 * and Alerts (raised during the trip).
 */

const TABS = ["Overview", "Stops", "Alerts"] as const;
type Tab = (typeof TABS)[number];

const clock = (iso: string | null | undefined) => (iso ? formatTime(new Date(iso)) : "—");

/** A titled list of label → value rows, like a spec sheet. */
function InfoList({ title, rows }: { title: string; rows: Array<[string, ReactNode]> }) {
  return (
    <section>
      <div className="px-4 pb-1 pt-3.5 text-[11px] font-semibold tracking-[0.05em] text-faint">{title.toUpperCase()}</div>
      <dl className="px-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 border-b border-line-rule py-[9px] last:border-b-0">
            <dt className="shrink-0 text-[12.5px] text-muted">{label}</dt>
            <dd className="min-w-0 text-right text-[12.5px] font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Analytics rows under the PIN: blurred placeholders and an unlock form until it is entered. */
function LockedList({ title, labels, onUnlocked }: { title: string; labels: string[]; onUnlocked: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/api/admin/analytics/unlock", { pin });
      onUnlocked();
    } catch (err) {
      setError(errorMessage(err));
      setPin("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="relative">
      <div aria-hidden className="pointer-events-none select-none blur-[5px]">
        <InfoList title={title} rows={labels.map((l) => [l, <Mono key={l}>••••</Mono>])} />
      </div>
      <form onSubmit={(e) => void unlock(e)} className="absolute inset-0 grid place-items-center px-4">
        <div className="w-full max-w-[250px] rounded-xl border border-line bg-surface px-3.5 py-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-ink">
            <Icon name="lock" size={15} /> {title}
          </div>
          <div className="mt-2 flex gap-1.5">
            <input
              type="password"
              inputMode="numeric"
              aria-label={`Analytics PIN for ${title}`}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="PIN"
              className={`min-w-0 flex-1 rounded-control border bg-surface px-2.5 py-1.5 text-center font-mono text-[13px] tracking-[0.3em] outline-none focus:border-primary ${error ? "border-critical" : "border-line"}`}
            />
            <PrimaryButton type="submit" loading={busy} disabled={pin.length < 4} className="!px-3 !py-1.5">
              Unlock
            </PrimaryButton>
          </div>
          {error ? <div className="mt-1.5 text-[11px] text-critical-text">{error}</div> : null}
        </div>
      </form>
    </section>
  );
}

/** Always in view under the bus's name: its page, and its live cameras (only with the engine on). */
function BusActions({ bus }: { bus: BusLive }) {
  const { user } = useAdmin();
  const [watching, setWatching] = useState(false);
  const engineOn = bus.fix?.ignition === true;
  const canWatch = bus.channels > 0 && CCTV_LIVE_ROLES.includes(user.role);
  return (
    <div className="grid grid-cols-2 gap-[7px] border-b border-line-soft px-3 py-2.5">
      <Link href={`/admin/buses/${bus.number}`} className="inline-flex items-center justify-center gap-1 rounded-[9px] border border-line py-[9px] text-xs font-semibold text-ink-2 hover:bg-canvas">
        <Icon name="directions_bus" size={15} />
        Bus page
      </Link>
      {canWatch ? (
        <button
          type="button"
          onClick={() => setWatching(true)}
          disabled={!engineOn}
          title={engineOn ? undefined : "The engine is off, so the cameras are off too"}
          className="inline-flex items-center justify-center gap-1 rounded-[9px] bg-primary py-[9px] text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-neutral-tint disabled:text-disabled"
        >
          <Icon name="videocam" size={15} />
          {engineOn ? "Live CCTV" : "CCTV · engine off"}
        </button>
      ) : (
        <span className="rounded-[9px] border border-line py-[9px] text-center text-xs text-faint">No live camera</span>
      )}
      {watching ? <DashcamModal busUid={bus.busId} title={`Bus ${bus.number}`} onClose={() => setWatching(false)} /> : null}
    </div>
  );
}

function Overview({ bus, detail, onUnlocked, schoolEstimated }: { bus: BusLive; detail: BusTripDetail | null; onUnlocked: () => void; schoolEstimated: boolean }) {
  const engineOn = bus.fix?.ignition === true;
  const t = detail?.trip ?? null;
  const e = detail?.efficiency ?? null;
  const h = detail?.history ?? null;

  return (
    <div className="pb-3">
      <InfoList
        title="Bus info"
        rows={[
          ["Registration", <Mono key="r">{bus.reg}</Mono>],
          ["Driver", bus.driver ?? "Not assigned"],
          ["Attendant", bus.attendant ?? "Not assigned"],
          ["Route", bus.route ?? "Not assigned"],
          ["Children assigned", <Mono key="s">{bus.riders} of {bus.capacity} seats</Mono>],
          [
            "Engine",
            <span key="e" className={`inline-flex items-center gap-1 ${engineOn ? "text-success-text" : "text-muted"}`}>
              <Icon name={engineOn ? "power_settings_new" : "power_off"} size={15} />
              {bus.fix?.ignition == null ? "Unknown" : engineOn ? "On" : "Off"}
            </span>,
          ],
          ["Speed", <Mono key="v">{bus.fix ? `${bus.fix.speed} km/h` : "—"}</Mono>],
          ["Last location", <span key="l" className="block font-medium">{bus.fix?.address ?? "—"}</span>],
          [
            "From school (straight line)",
            <Mono key="k">{bus.kmFromSchool == null ? "—" : `${num(bus.kmFromSchool, 1)} km${schoolEstimated ? " · est." : ""}`}</Mono>,
          ],
          ["GPS", bus.linked ? (bus.fix ? `Fix ${ago(bus.fix.ageMin)}` : "No fix yet") : "Not linked"],
        ]}
      />

      {t ? (
        <InfoList
          title={`${t.label}${t.running ? " · running" : ""}`}
          rows={[
            ["Started", <Mono key="s">{clock(t.start)}</Mono>],
            ...(t.running
              ? ([["Running for", <Mono key="r">{hm(t.durationS)}</Mono>]] as Array<[string, ReactNode]>)
              : ([
                  ["Ended", <Mono key="e">{clock(t.end)}</Mono>],
                  ["Duration", <Mono key="d">{hm(t.durationS)}</Mono>],
                ] as Array<[string, ReactNode]>)),
            ["Distance", <Mono key="k">{num(t.distanceKm, 1)} km</Mono>],
            ["From", <span key="f" className="block truncate font-medium">{t.from ?? "—"}</span>],
            ["To", <span key="t" className="block truncate font-medium">{t.to ?? (t.running ? "On the way" : "—")}</span>],
          ]}
        />
      ) : null}

      {detail && t ? (
        detail.locked || !e ? (
          <LockedList title="Trip efficiency" labels={["Engine on", "Idling", "Fuel (estimated)", "Cost (estimated)", "Top speed", "Overspeeding"]} onUnlocked={onUnlocked} />
        ) : (
          <InfoList
            title="Trip efficiency"
            rows={[
              ["Engine on", <Mono key="e">{hm(e.engineOnS)}</Mono>],
              ["Idling (engine on, standing)", <Mono key="i" style={e.idleS > 15 * 60 ? { color: "#c5221f" } : undefined}>{hm(e.idleS)}</Mono>],
              ["Fuel (estimated)", <Mono key="f">{num(e.fuelL, 1)} L at {num(e.mileageKmpl, 1)} km/L</Mono>],
              ["Cost (estimated)", <Mono key="c">{rupees(e.costRs)}{e.idleCostRs ? ` · idling ${rupees(e.idleCostRs)}` : ""}</Mono>],
              ["Average speed moving", <Mono key="a">{e.avgMovingSpeed} km/h</Mono>],
              ["Top speed", <Mono key="m" style={e.maxSpeed > e.speedLimit ? { color: "#c5221f" } : undefined}>{e.maxSpeed} km/h</Mono>],
              ["Over the limit", <Mono key="o">{e.overspeedCount}× above {e.speedLimit} km/h</Mono>],
              [
                "Stops",
                <Mono key="st">
                  {e.stopsServed} stopped{e.stopsMissed ? ` · ${e.stopsMissed} not` : ""}
                  {e.stopsAhead ? ` · ${e.stopsAhead} to go` : ""}
                </Mono>,
              ],
            ]}
          />
        )
      ) : null}

      {detail ? (
        detail.locked || !h ? (
          <LockedList title="Last 30 days" labels={["Days on the road", "Distance", "Fuel cost (estimated)", "Idling", "On time at school", "Safety score"]} onUnlocked={onUnlocked} />
        ) : (
          <InfoList
            title="Last 30 days"
            rows={[
              ["Days on the road", <Mono key="d">{h.days}</Mono>],
              ["Distance", <Mono key="k">{num(h.km, 1)} km</Mono>],
              ["Fuel (estimated)", <Mono key="f">{num(h.fuelL, 1)} L · {rupees(h.costRs)}</Mono>],
              ["Idling", <Mono key="i">{hm(h.idleS)} · {h.idlePct}% · {rupees(h.idleCostRs)}</Mono>],
              ["Overspeed events", <Mono key="o">{h.overspeedEvents}</Mono>],
              ["Stops not stopped at", <Mono key="m">{h.missedStops}</Mono>],
              [
                `At school by the ${clockLabel(h.bellTime)} bell`,
                <Mono key="t">{h.onTimePct == null ? "—" : `${h.onTimePct}% of ${h.schoolArrivals} mornings`}</Mono>,
              ],
              ["Safety score", <Mono key="s" style={{ color: h.score >= 85 ? "#1e8e3e" : h.score >= 70 ? "#8f5b00" : "#c5221f" }}>{h.score} / 100</Mono>],
            ]}
          />
        )
      ) : null}
    </div>
  );
}

const STOP_STATE = {
  stopped: { label: "Stopped", color: "#1e8e3e", icon: "check_circle" },
  passed: { label: "Drove past", color: "#8f5b00", icon: "warning" },
  missed: { label: "Not on the road taken", color: "#c5221f", icon: "wrong_location" },
  pending: { label: "Not reached yet", color: "#8b919b", icon: "schedule" },
} as const;

const MARK_COLOR = { Boarded: "#1e8e3e", Dropped: "#1a73e8", Absent: "#c5221f", "Not marked": "#8b919b" } as const;

function Stops({ detail }: { detail: BusTripDetail }) {
  if (!detail.stops.length) return <div className="px-4 py-8 text-center text-[12.5px] text-faint">This bus&apos;s route has no stops with map pins yet.</div>;
  return (
    <ol className="p-3">
      {detail.stops.map((s, i) => {
        const st = STOP_STATE[s.status];
        const last = i === detail.stops.length - 1;
        return (
          <li key={s.stopId} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="grid size-6 shrink-0 place-items-center rounded-full font-mono text-[10.5px] font-semibold text-white" style={{ background: st.color }}>
                {s.seq}
              </span>
              {!last ? <span className="w-[1.5px] flex-1 bg-line" /> : null}
            </div>
            <div className={`min-w-0 flex-1 ${last ? "" : "pb-3.5"}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-ink">{s.name}</span>
                <Mono className="shrink-0 text-[11.5px] text-muted">{s.at ? clock(s.at) : "—"}</Mono>
              </div>
              <div className="flex items-center gap-1 text-[11.5px]" style={{ color: st.color }}>
                <Icon name={st.icon} size={13} />
                {st.label}
                {s.status === "stopped" && s.dwellS >= 30 ? <span className="text-faint">· {hm(s.dwellS)}</span> : null}
              </div>
              {s.students.length ? (
                <ul className="mt-1.5 flex flex-col gap-1 rounded-control bg-canvas px-2.5 py-2">
                  {s.students.map((k) => (
                    <li key={k.id} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="min-w-0 truncate">
                        {k.name} <span className="text-faint">· {k.cls}</span>
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold" style={{ color: MARK_COLOR[k.mark] }}>
                        {k.mark}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-1 text-[11.5px] text-faint">No children board here.</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function LiveBusPanel({
  bus,
  onBack,
  onTrip,
  schoolEstimated = false,
}: {
  bus: BusLive;
  onBack: () => void;
  onTrip: (trip: BusTrip | null) => void;
  /** The school's position was worked out from trips, not set in Settings. */
  schoolEstimated?: boolean;
}) {
  const today = localDate();
  const [day, setDay] = useState(today);
  const [tripKey, setTripKey] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const status = liveLabel(bus);
  const path = bus.linked ? `/api/admin/telematics/${bus.busId}/trip?date=${day}${tripKey ? `&trip=${tripKey}` : ""}` : null;
  const res = useApi<BusTripDetail>(path);
  usePoll(res.reload, 60_000);
  const detail = res.data;

  // The map draws the chosen trip.
  const trip = detail?.trip ?? null;
  useEffect(() => onTrip(trip), [trip, onTrip]);

  const days = useMemo(() => [{ id: today, label: "Today" }, { id: addDays(today, -1), label: "Yesterday" }], [today]);

  return (
    <Card className="flex min-h-0 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line-soft px-3 py-[11px]">
        <button type="button" onClick={onBack} aria-label="All buses" className="grid size-8 place-items-center rounded-chip text-muted hover:bg-canvas">
          <Icon name="arrow_back" size={19} />
        </button>
        <Mono className="flex-1 text-[15px] font-semibold tracking-[-0.015em]">Bus {bus.number}</Mono>
        <StatusPill pill={pill(status.label, status.kind)} />
      </div>
      <BusActions bus={bus} />

      {bus.linked ? (
        <div className="border-b border-line-soft px-3 py-2.5">
          <div className="mb-1.5 text-[10.5px] font-semibold tracking-[0.05em] text-faint">TRIP</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {days.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={day === d.id}
                onClick={() => {
                  setDay(d.id);
                  setTripKey(null);
                }}
                className={`rounded-pill border px-2.5 py-1 text-[12px] font-semibold ${day === d.id ? "border-ink bg-ink text-white" : "border-line text-muted hover:bg-canvas"}`}
              >
                {d.label}
              </button>
            ))}
            <input
              type="date"
              aria-label="Day"
              value={day}
              max={today}
              onChange={(e) => {
                if (!e.target.value) return;
                setDay(e.target.value);
                setTripKey(null);
              }}
              className="rounded-pill border border-line bg-surface px-2.5 py-[3px] font-mono text-[11.5px]"
            />
            {res.loading && detail ? <Spinner size={13} /> : null}
          </div>
          {detail?.trips.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {detail.trips.map((t) => {
                const on = detail.trip?.key === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setTripKey(t.key)}
                    className={`rounded-control border px-2.5 py-1.5 text-left ${on ? "border-primary bg-primary-tint" : "border-line hover:bg-canvas"}`}
                  >
                    <div className={`text-[12px] font-semibold ${on ? "text-primary" : "text-ink"}`}>
                      {t.label}
                      {t.running ? <span className="ml-1 text-[10.5px] text-success-text">● running</span> : null}
                    </div>
                    <Mono className="text-[11px] text-muted">
                      {clock(t.start)}–{t.end ? clock(t.end) : "now"} · {num(t.distanceKm, 1)} km
                    </Mono>
                  </button>
                );
              })}
            </div>
          ) : detail ? (
            <div className="mt-2 text-[12px] text-faint">No trips {day === today ? "yet today" : `on ${formatDay(day)}`}.</div>
          ) : null}
        </div>
      ) : null}

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
            {t === "Alerts" && detail?.alerts.length ? <span className="ml-1 font-mono text-[11px] opacity-80">{detail.alerts.length}</span> : null}
          </button>
        ))}
      </div>

      <div className="max-h-[560px] min-h-0 overflow-auto">
        {!bus.linked ? (
          tab === "Overview" ? (
            <Overview bus={bus} detail={null} onUnlocked={() => void res.reload()} schoolEstimated={schoolEstimated} />
          ) : (
            <div className="px-4 py-8 text-center text-[12.5px] text-faint">No GPS tracker linked to this bus.</div>
          )
        ) : !detail ? (
          res.error ? <div className="px-4 py-8 text-center text-[12.5px] text-faint">{res.error}</div> : <LoadingBlock label="Loading the trip…" />
        ) : tab === "Overview" ? (
          <Overview bus={bus} detail={detail} onUnlocked={() => void res.reload()} schoolEstimated={schoolEstimated} />
        ) : !detail.trip ? (
          <div className="px-4 py-8 text-center text-[12.5px] text-faint">Pick a day with a trip.</div>
        ) : tab === "Stops" ? (
          <Stops detail={detail} />
        ) : detail.alerts.length ? (
          <AlertTimeline items={detail.alerts} compact />
        ) : (
          <div className="px-4 py-8 text-center text-[12.5px] text-faint">No alerts during this trip.</div>
        )}
      </div>
    </Card>
  );
}
