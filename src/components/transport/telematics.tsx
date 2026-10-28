"use client";

import { useMemo, useState } from "react";
import { AlertTimeline } from "@/components/transport/alert-timeline";
import { LiveMap } from "@/components/transport/live-map";
import { Card, CardHeader, Icon, Mono, PrimaryButton, SecondaryButton, StatusPill } from "@/components/transport/ui";
import { api, errorMessage } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { usePoll } from "@/lib/api/use-poll";
import type { TelematicsDay, TelematicsLive, TrackerAlertRow, TrackerSettings } from "@/lib/api/types";
import { pill, TONE, type ToneKind } from "@/lib/transport/tone";
import { formatDay, formatTime, localDate, addDays } from "@/lib/time";
import { LoadingBlock } from "@/components/transport/skeleton";

/*
 * Tracker data from LivePin on the bus page. Every block reads our API
 * (src/app/api/admin/telematics/*), never the vendor directly.
 */

/** 27322 → "7h 35m" */
export const duration = (s: number) => {
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};
const ACRONYM = /\b(gnss|gps|gsm|tts|ic|vss|sos|adas|acc)\b/g;
const words = (flag: string) =>
  flag
    .replace(/_/g, " ")
    .replace(ACRONYM, (a) => a.toUpperCase())
    .replace(/^\w/, (c) => c.toUpperCase());
const time = (iso: string | null) => (iso ? formatTime(new Date(iso)) : "—");
/** "10:56 AM · 18 Oct": short enough for a reading tile. */
const stamp = (iso: string | null) => (iso ? `${time(iso)} · ${formatDay(new Date(iso)).replace(/ \d{4}$/, "")}` : "—");
const yesNo = (v: boolean | null, yes = "Yes", no = "No") => (v == null ? "Not reported" : v ? yes : no);
const STATUS_KIND: Record<string, ToneKind> = { MOVING: "ontime", IDLE: "good", STOPPED: "offline", PARKED: "offline", NO_DATA: "bad" };

export const INTERVAL_LABEL: Record<string, string> = {
  SECOND_10: "Every 10 seconds",
  MINUTE_1: "Every minute",
  MINUTE_5: "Every 5 minutes",
  MINUTE_10: "Every 10 minutes",
  MINUTE_15: "Every 15 minutes",
  MINUTE_30: "Every 30 minutes",
  HOUR_1: "Every hour",
  HOUR_3: "Every 3 hours",
};

/** The live tracker reading for a bus, refreshed every 15 seconds. */
export function useTelematics(busUid: string | undefined) {
  const live = useApi<TelematicsLive>(busUid ? `/api/admin/telematics/${busUid}/live` : null);
  usePoll(live.reload, 15_000);
  return live;
}

function Reading({ label, value, mono = false, tone }: { label: string; value: string; mono?: boolean; tone?: ToneKind }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] tracking-[0.02em] text-faint">{label}</div>
      <div className={`truncate text-[13px] font-semibold ${mono && /\d/.test(value) ? "font-mono" : ""}`} style={tone ? { color: TONE[tone].fg } : undefined}>
        {value}
      </div>
    </div>
  );
}

// ── Overview: tracker health ──────────────────────────────────────────────

export function TrackerHealthCard({ t, error }: { t: TelematicsLive | null; error: string }) {
  return (
    <Card className="px-5 py-[18px]">
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <div className="text-[13.5px] font-semibold">Tracker health</div>
        {t ? <Mono className="text-[11.5px] text-faint">{t.vehicleNo}</Mono> : null}
      </div>
      {error && !t ? <div className="text-[12.5px] text-muted">{error}</div> : null}
      {!t && !error ? <LoadingBlock label="Reading the tracker…" className="!justify-start !px-0 !py-2" /> : null}
      {t ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
          <Reading label="TRACKER" value={t.model ?? "—"} />
          <Reading label="IMEI" value={t.imei} mono />
          <Reading label="LIVEPIN VEHICLE ID" value={t.vehicleId} mono />
          <Reading label="VEHICLE TYPE" value={t.vehicleType ? words(t.vehicleType.toLowerCase()) : "Not reported"} />
          <Reading label="GPS LOCK" value={yesNo(t.sensors.gpsLock, "Locked", "Searching")} tone={t.sensors.gpsLock === false ? "bad" : undefined} />
          <Reading label="SATELLITES" value={t.health.satellites == null ? "Not reported" : String(t.health.satellites)} mono />
          <Reading label="BATTERY" value={t.health.batteryPercent == null ? "Not reported" : `${t.health.batteryPercent}%`} mono />
          <Reading
            label="MAIN POWER"
            value={t.alarms.includes("terminal_main_power_turned_off") ? "Cut" : t.alarms.includes("terminal_main_power_undervoltage") ? "Low voltage" : t.health.externalVoltage != null ? `${t.health.externalVoltage} V` : "Not reported"}
            tone={t.alarms.some((a) => a.startsWith("terminal_main_power")) ? "delayed" : undefined}
          />
          <Reading label="BACKUP BATTERY" value={t.health.batteryVoltage == null ? "Not reported" : `${t.health.batteryVoltage} V`} mono />
          <Reading label="GNSS STATUS" value={t.health.gnssStatus ?? "Not reported"} />
          <Reading label="MOBILE SIGNAL" value={t.health.gsmSignal == null ? "Not reported" : `${t.health.gsmSignal}${t.health.gsmOperator ? ` · ${t.health.gsmOperator}` : ""}`} />
          <Reading label="DATA DELAY" value={t.fix.delayS == null ? "—" : `${t.fix.delayS} s`} mono />
          <Reading label="REPORTS" value={!t.settings ? "Not reported" : (INTERVAL_LABEL[t.settings.interval ?? ""] ?? t.settings.interval ?? "—")} />
          <Reading label="OVERSPEED ALERT" value={!t.settings ? "Not reported" : t.settings.overspeed ? `Above ${t.settings.overspeed_limit} km/h` : "Off"} />
          <Reading label="DASHCAM" value={t.dashcamChannels ? `${t.dashcamChannels} channels` : "None"} />
          <Reading
            label="SUBSCRIPTION"
            value={t.subscriptionExpiry ? `Until ${formatDay(t.subscriptionExpiry)}` : "—"}
            tone={t.subscriptionExpiry && t.subscriptionExpiry < addDays(localDate(), 30) ? "delayed" : undefined}
          />
        </div>
      ) : null}
      {t?.health.at ? (
        <div className="mt-3.5 text-[11px] text-faint">
          Device readings as of <Mono>{time(t.health.at)}</Mono>
        </div>
      ) : null}
    </Card>
  );
}

// ── Live Trip: readings, sensors, alarms ──────────────────────────────────

export function LiveReadings({ t }: { t: TelematicsLive }) {
  const status = t.fix.status ?? "NO_DATA";
  const doors = Object.entries(t.sensors.doors) as Array<[string, boolean | null]>;
  const open = doors.filter(([, v]) => v === true).map(([k]) => k);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-3">
        <div className="text-[13.5px] font-semibold">Live readings</div>
        <StatusPill pill={pill(`${words(status.toLowerCase())}${t.fix.statusSince ? ` since ${time(t.fix.statusSince)}` : ""}`, STATUS_KIND[status] ?? "offline")} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 px-4 py-3.5 sm:grid-cols-3">
        <Reading label="SPEED" value={`${t.fix.speed} km/h`} mono tone={t.settings && t.fix.speed > t.settings.overspeed_limit ? "bad" : undefined} />
        <Reading label="HEADING" value={t.fix.heading == null ? "—" : `${Math.round(t.fix.heading)}°`} mono />
        <Reading label="ALTITUDE" value={t.fix.altitude == null ? "—" : `${t.fix.altitude} m`} mono />
        <Reading label="IGNITION" value={yesNo(t.fix.ignition, "On", "Off")} />
        <Reading label="LAST FIX" value={stamp(t.fix.at)} mono />
        <Reading label="RECEIVED BY LIVEPIN" value={t.fix.receivedAt ? `${time(t.fix.receivedAt)}${t.fix.delayS != null ? ` (+${t.fix.delayS} s)` : ""}` : "—"} mono />
        <Reading label="STATUS SINCE" value={stamp(t.fix.statusSince)} mono />
        <Reading label="ENGINE RUNNING" value={yesNo(t.sensors.running, "Running", "Not running")} />
        <Reading label="LOAD" value={t.sensors.load ? words(t.sensors.load.toLowerCase()) : "Not reported"} />
        <Reading label="DOORS" value={doors.every(([, v]) => v == null) ? "Not reported" : open.length ? `Open: ${open.join(", ")}` : "All closed"} tone={open.length ? "delayed" : undefined} />
        <Reading label="DOOR LOCK" value={yesNo(t.sensors.doorLocked, "Locked", "Unlocked")} />
        <Reading label="CIRCUIT" value={yesNo(t.sensors.circuitConnected, "Connected", "Disconnected")} tone={t.sensors.circuitConnected === false ? "bad" : undefined} />
        <Reading label="FUEL LINE" value={yesNo(t.sensors.fuelLineConnected, "Connected", "Cut")} tone={t.sensors.fuelLineConnected === false ? "bad" : undefined} />
        <Reading label="POSITIONING" value={t.sensors.constellations.length ? t.sensors.constellations.join(" + ") : yesNo(t.sensors.gpsLock, "Locked", "No lock")} />
        <Reading label="COORDINATES" value={t.fix.lat != null ? `${t.fix.lat.toFixed(5)}, ${t.fix.lng?.toFixed(5)}` : "—"} mono />
      </div>
      {t.fix.address ? (
        <div className="flex items-start gap-2 border-t border-line-rule px-4 py-3 text-[12.5px] text-muted">
          <Icon name="location_on" size={17} className="shrink-0 text-faint" />
          {t.fix.address}
        </div>
      ) : null}
      <AlarmPanel flags={t.alarmFlags} active={t.alarms} />
    </Card>
  );
}

/** Group a device alarm flag by what it is about, from its name. */
function alarmGroup(flag: string): string {
  if (/emergency|collision|rollover|fatigue|risk|vibration|tamper/.test(flag)) return "Safety";
  if (/speed/.test(flag)) return "Speed";
  if (/power/.test(flag)) return "Power";
  if (/malfunction|antenna|short/.test(flag)) return "Device faults";
  if (/illegal|stolen|parking/.test(flag)) return "Security";
  if (/area|route|track|time/.test(flag)) return "Areas and driving time";
  return "Other";
}

/** Every alarm flag the tracker reports, on or off, grouped. Active ones first in each group. */
function AlarmPanel({ flags, active }: { flags: Record<string, boolean>; active: string[] }) {
  const names = Object.keys(flags).length ? Object.keys(flags) : active;
  const groups = new Map<string, string[]>();
  for (const f of names) groups.set(alarmGroup(f), [...(groups.get(alarmGroup(f)) ?? []), f]);
  const on = (f: string) => flags[f] === true || active.includes(f);
  return (
    <div className="border-t border-line-rule px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10.5px] tracking-[0.02em] text-faint">ALARMS · {names.length} FLAGS FROM THE TRACKER</div>
        <div className={`text-[11.5px] font-semibold ${active.length ? "text-warning-text" : "text-success-text"}`}>
          {active.length ? `${active.length} active` : "None active"}
        </div>
      </div>
      {!names.length ? <div className="text-[12.5px] text-faint">The tracker has not reported its alarm flags.</div> : null}
      <div className="flex flex-col gap-2.5">
        {[...groups.entries()].map(([group, list]) => (
          <div key={group}>
            <div className="mb-1 text-[11px] font-semibold text-muted">{group}</div>
            <div className="flex flex-wrap gap-1.5">
              {[...list].sort((a, b) => Number(on(b)) - Number(on(a))).map((f) => (
                <span
                  key={f}
                  className={`rounded-pill px-2.5 py-1 text-[11.5px] font-medium ${
                    on(f) ? "bg-warning-tint font-semibold text-warning-text" : "bg-neutral-tint text-faint"
                  }`}
                >
                  {words(f.replace(/^terminal_/, ""))}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── History: daily report and route replay ────────────────────────────────

export function DayHistory({ busUid }: { busUid: string }) {
  const [day, setDay] = useState(localDate());
  const res = useApi<TelematicsDay>(`/api/admin/telematics/${busUid}/day?date=${day}`);
  const r = res.data?.report;
  const track = useMemo(
    () => [{ id: "track", name: "Track", points: (res.data?.track ?? []).map((p) => ({ lat: p.lat, lng: p.lng, name: `${time(p.at)} · ${p.speed} km/h` })) }],
    [res.data],
  );
  const lastPoint = res.data?.track.at(-1);
  const totalS = r ? Math.max(1, r.timeline.reduce((n, e) => n + e.durationS, 0)) : 1;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center gap-2.5">
        <SecondaryButton icon="chevron_left" onClick={() => setDay(addDays(day, -1))}>Previous day</SecondaryButton>
        <input
          type="date"
          aria-label="Day"
          value={day}
          max={localDate()}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          className="rounded-control border border-line bg-surface px-3 py-2 font-mono text-[12.5px]"
        />
        <SecondaryButton onClick={() => setDay(addDays(day, 1))} disabled={day >= localDate()}>Next day</SecondaryButton>
        <span className="text-[12px] text-faint">{res.loading ? "Loading…" : res.error || `From the tracker · ${formatDay(day)}`}</span>
      </div>

      {r ? (
        <>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 lg:grid-cols-6">
            {(
              [
                ["Distance", `${r.distanceKm} km`],
                ["Moving", duration(r.moving)],
                ["Engine on", duration(r.engineOn)],
                ["Idle", duration(r.idle)],
                ["Stopped", duration(r.stopped)],
                ["Parked", duration(r.parked)],
                ["Max speed", `${r.maxSpeed} km/h`],
                ["Avg speed", `${r.avgSpeed} km/h`],
                ["Overspeed", `${r.overspeedKm} km`],
                ["Overspeed limit", r.overspeedLimit ? `${r.overspeedLimit} km/h` : "—"],
                ["Fuel used", r.fuelUsed || r.fuelFilled ? `${r.fuelUsed} L` : "No sensor"],
                ["Fuel filled", r.fuelUsed || r.fuelFilled ? `${r.fuelFilled} L` : "No sensor"],
              ] as const
            ).map(([label, value]) => (
              <Card key={label} className="px-3.5 py-3">
                <div className="text-[11px] text-muted">{label}</div>
                <Mono className="mt-0.5 block text-[18px] font-medium tracking-[-0.02em]">{value}</Mono>
              </Card>
            ))}
          </div>

          <Card className="px-5 py-[18px]">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[13.5px] font-semibold">Day timeline</div>
              <div className="flex gap-3 text-[11px] text-muted">
                <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-primary" /> Moving</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-sm bg-line" /> Stopped</span>
              </div>
            </div>
            <div className="flex h-4 overflow-hidden rounded-pill bg-line-soft">
              {r.timeline.map((e, i) => (
                <div
                  key={i}
                  title={`${e.type === "MOVE" ? "Moving" : "Stopped"} ${time(e.start)}–${time(e.end)} · ${duration(e.durationS)}${e.address ? ` · ${e.address}` : ""}`}
                  style={{ width: `${(e.durationS / totalS) * 100}%`, background: e.type === "MOVE" ? "#1a73e8" : "#dadce0" }}
                />
              ))}
            </div>
          </Card>
        </>
      ) : res.data && !r ? (
        <Card className="px-6 py-10 text-center text-[13px] text-faint">No report from the tracker for this day.</Card>
      ) : null}

      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="relative h-[460px] overflow-hidden rounded-card border border-line bg-[#e8eaed]">
          <LiveMap
            trails={track.map((r) => ({ id: "End", points: r.points }))}
            vehicles={lastPoint ? [{ id: "End", lat: lastPoint.lat, lng: lastPoint.lng, heading: null, state: "stopped", routeId: null }] : []}
          />
          <div className="absolute left-4 top-4 z-[500] rounded-control border border-line bg-surface px-3 py-2 text-[12px]">
            Route replay · <Mono>{res.data?.track.length ?? 0}</Mono> points
          </div>
        </div>

        <Card className="max-h-[460px] overflow-auto">
          <CardHeader title={`Stops (${r?.stops.length ?? 0})`} />
          {(r?.stops ?? []).map((s, i) => (
            <div key={i} className="border-b border-line-rule px-[18px] py-2.5">
              <Mono className="text-[12px] text-ink-2">{time(s.start)} – {time(s.end)}</Mono>
              <div className="truncate text-[12.5px] text-muted">{s.address ?? "—"}{s.geofence ? ` · ${s.geofence}` : ""}</div>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid gap-[18px] xl:grid-cols-3">
        <EventCard title="Ignition" rows={(r?.ignition ?? []).map((e) => [`${time(e.start)} – ${time(e.end)}`, `Engine ${e.state.toLowerCase()}`, e.address ?? ""])} />
        <EventCard title="Geofence" rows={(r?.geofence ?? []).map((g) => [time(g.at), g.event === "ENTER" ? "Entered" : g.event === "EXIT" ? "Left" : g.event, g.fence ?? ""])} />
        <EventCard title="Overspeed" rows={(r?.overspeed ?? []).map((o) => [`${time(o.start)} – ${time(o.end)}`, o.maxSpeed ? `${o.maxSpeed} km/h` : "Overspeed", o.address ?? ""])} />
      </div>
    </div>
  );
}

function EventCard({ title, rows }: { title: string; rows: Array<[string, string, string]> }) {
  return (
    <Card className="max-h-[320px] overflow-auto">
      <CardHeader title={`${title} (${rows.length})`} />
      {rows.length === 0 ? <div className="px-[18px] py-6 text-center text-[12.5px] text-faint">None this day.</div> : null}
      {rows.map(([when, what, where], i) => (
        <div key={i} className="border-b border-line-rule px-[18px] py-2.5">
          <div className="flex justify-between gap-2">
            <span className="text-[12.5px] font-medium">{what}</span>
            <Mono className="shrink-0 text-[11.5px] text-faint">{when}</Mono>
          </div>
          {where ? <div className="truncate text-[11.5px] text-faint">{where}</div> : null}
        </div>
      ))}
    </Card>
  );
}

// ── Alerts: the tracker's alert feed ──────────────────────────────────────

export function AlertFeed({ busUid }: { busUid: string }) {
  const [type, setType] = useState("");
  const [span, setSpan] = useState(7);
  const to = localDate();
  const from = addDays(to, -(span - 1));
  const res = useApi<{ items: TrackerAlertRow[]; types: Array<{ type: string; label: string; count: number }>; catalogue: Array<{ type: string; label: string }> }>(
    `/api/admin/telematics/${busUid}/alerts?from=${from}&to=${to}${type ? `&type=${type}` : ""}`,
  );
  usePoll(res.reload, 60_000);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setType("")} aria-pressed={!type} className="rounded-pill border px-3 py-1.5 text-[12px] font-semibold" style={!type ? { background: "#16181b", color: "#fff", borderColor: "#16181b" } : { borderColor: "#e4e7eb" }}>
          All
        </button>
        {(res.data?.types ?? []).map((t) => (
          <button key={t.type} type="button" onClick={() => setType(t.type)} aria-pressed={type === t.type} className="rounded-pill border px-3 py-1.5 text-[12px] font-semibold" style={type === t.type ? { background: "#16181b", color: "#fff", borderColor: "#16181b" } : { borderColor: "#e4e7eb" }}>
            {t.label} <Mono className="opacity-70">{t.count}</Mono>
          </button>
        ))}
        <div className="flex-1" />
        <select aria-label="Period" value={span} onChange={(e) => setSpan(Number(e.target.value))} className="rounded-chip border border-line bg-surface px-2 py-1.5 text-[12px]">
          <option value={1}>Today</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>
      {res.data?.catalogue.length ? (
        <div className="rounded-xl border border-line px-4 py-3">
          <div className="mb-2 text-[10.5px] tracking-[0.02em] text-faint">ALERTS LIVEPIN CAN SEND FOR THIS TRACKER</div>
          <div className="flex flex-wrap gap-1.5">
            {res.data.catalogue.map((c) => {
              const seen = res.data?.types.find((t) => t.type === c.type)?.count ?? 0;
              return (
                <span key={c.type} className={`rounded-pill px-2.5 py-1 text-[11.5px] ${seen ? "bg-primary-tint font-semibold text-primary-hover" : "bg-neutral-tint text-muted"}`}>
                  {c.label}
                  {seen ? <Mono className="ml-1">{seen}</Mono> : null}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
      {res.data && res.data.items.length === 0 ? (
        <Card className="px-6 py-10 text-center text-[12.5px] text-faint">No alerts from the tracker in this period.</Card>
      ) : res.data ? (
        <AlertTimeline items={res.data.items} />
      ) : null}
    </div>
  );
}

// ── Settings: alerts and reporting interval (shared with the bus form) ─────

export function TrackerSettingsFields({ value, onChange, disabled = false }: { value: TrackerSettings; onChange: (v: TrackerSettings) => void; disabled?: boolean }) {
  const toggle = (k: keyof TrackerSettings, label: string) => (
    <label className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
      <span>{label}</span>
      <input type="checkbox" checked={Boolean(value[k])} disabled={disabled} onChange={(e) => onChange({ ...value, [k]: e.target.checked })} aria-label={label} />
    </label>
  );
  return (
    <div className="grid gap-x-6 sm:grid-cols-2">
      <div>
        {toggle("overspeed", "Overspeed alerts")}
        <label className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
          <span>Overspeed limit (km/h)</span>
          <input
            type="number"
            aria-label="Overspeed limit (km/h)"
            min={20}
            max={120}
            disabled={disabled || !value.overspeed}
            value={value.overspeed_limit}
            onChange={(e) => onChange({ ...value, overspeed_limit: Number(e.target.value) || value.overspeed_limit })}
            className="w-20 rounded-chip border border-line px-2 py-1 text-right font-mono text-[12.5px]"
          />
        </label>
        {toggle("engine_on", "Engine on/off alerts")}
      </div>
      <div>
        {toggle("geofence_events", "Geofence alerts")}
        {toggle("safe_parking", "Safe-parking alerts")}
        <label className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
          <span>Report position</span>
          <select
            aria-label="Report position"
            disabled={disabled}
            value={value.interval ?? "MINUTE_1"}
            onChange={(e) => onChange({ ...value, interval: e.target.value })}
            className="rounded-chip border border-line bg-surface px-2 py-1 text-[12.5px]"
          >
            {Object.entries(INTERVAL_LABEL).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

/** Edit the tracker's settings from the bus page. */
export function TrackerSettingsCard({ busUid, initial, canEdit, onSaved }: { busUid: string; initial: TrackerSettings; canEdit: boolean; onSaved: (msg: string) => void }) {
  const [draft, setDraft] = useState<TrackerSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const value = draft ?? initial;
  const save = async () => {
    setSaving(true);
    try {
      await api.put<TrackerSettings>(`/api/admin/telematics/${busUid}/settings`, value);
      setDraft(null);
      onSaved("Tracker settings applied at LivePin.");
    } catch (error) {
      onSaved(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card className="px-5 py-[18px]">
      <div className="mb-2 text-[13.5px] font-semibold">Tracker settings</div>
      <TrackerSettingsFields value={value} onChange={setDraft} disabled={!canEdit} />
      {canEdit ? (
        <div className="mt-3 flex justify-end gap-2">
          <SecondaryButton onClick={() => setDraft(null)} disabled={!draft}>Reset</SecondaryButton>
          <PrimaryButton onClick={() => void save()} disabled={saving || !draft}>{saving ? "Applying…" : "Apply to tracker"}</PrimaryButton>
        </div>
      ) : null}
    </Card>
  );
}
