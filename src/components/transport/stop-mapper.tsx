"use client";

import { useMemo, useState } from "react";
import { StopMapCanvas, type CanvasPin } from "@/components/transport/stop-map-canvas";
import { Card, Icon, Mono, PrimaryButton, SecondaryButton } from "@/components/transport/ui";
import { SelectInput } from "@/components/transport/form-controls";
import { api, errorMessage } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import type { StopMapData, StopMapPause, StopMapTrip, StopSuggestion } from "@/lib/api/types";
import { addDays, formatTime, localDate } from "@/lib/time";
import { distanceM } from "@/lib/geo";
import { useStore } from "@/lib/transport/store";

/**
 * "Map stops from a trip": put a route's stops where the bus really stops.
 * Pick a bus and a day; the trip shows with every pause. Each stop starts
 * from its saved pin, or a suggestion (its name on OpenStreetMap, moved to
 * where the bus paused). Place or drag pins; pickup and drop times come from
 * when the bus passed on the morning and evening trips, and can be edited.
 * Save writes the pins, the order (by pickup time) and the times.
 */

/** A pin further than this from a trip gets no time from it. */
const TIME_M = 300;

interface Pin {
  lat: number;
  lng: number;
  pickup: string;
  drop: string;
  suggested: boolean;
  source: string;
}

/** "07:33" in the school's time. */
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

/** When the bus passed nearest a place on a trip, if it came within 300 m. */
function passedAt(trip: StopMapTrip | null, at: { lat: number; lng: number }, pause: StopMapPause | null): string {
  if (!trip) return "";
  if (pause && trip.pauses.includes(pause)) return hhmm(pause.start);
  let best: { at: string; m: number } | null = null;
  for (const p of trip.points) {
    const m = distanceM(p, at);
    if (!best || m < best.m) best = { at: p.at, m };
  }
  return best && best.m <= TIME_M ? hhmm(best.at) : "";
}

/** The nearest point of the trip's road, so a dropped pin sits on it. */
function onRoad(trip: StopMapTrip | null, at: { lat: number; lng: number }) {
  if (!trip) return at;
  let best: { lat: number; lng: number; m: number } | null = null;
  for (const p of trip.points) {
    const m = distanceM(p, at);
    if (!best || m < best.m) best = { lat: p.lat, lng: p.lng, m };
  }
  return best && best.m <= TIME_M ? { lat: best.lat, lng: best.lng } : at;
}

const tripLabel = (t: StopMapTrip) => `${t.label} · ${formatTime(new Date(t.start))} – ${t.end ? formatTime(new Date(t.end)) : "now"}`;

export function StopMapper({ routeId }: { routeId: string }) {
  const { dispatch } = useStore();
  const [bus, setBus] = useState("");
  const [day, setDay] = useState(addDays(localDate(), -1));
  const res = useApi<StopMapData>(`/api/admin/stop-map/${routeId}?date=${day}${bus ? `&bus=${bus}` : ""}`);
  const data = res.data;
  const busId = bus || data?.busId || "";
  const trips = useMemo(() => data?.trips ?? [], [data]);
  const [pickupKey, setPickupKey] = useState("");
  const [dropKey, setDropKey] = useState("");
  const pickup = trips.find((t) => t.key === pickupKey) ?? trips[0] ?? null;
  const drop = trips.find((t) => t.key === dropKey) ?? (trips.length > 1 ? trips[trips.length - 1]! : null);

  const suggest = useApi<StopSuggestion[]>(
    data && busId && pickup ? `/api/admin/stop-map/${routeId}/suggest?bus=${busId}&date=${day}&trip=${pickup.key}` : null,
  );

  // Edits on top of what the server has: a pin per stop the admin touched.
  const [edits, setEdits] = useState<Record<string, Pin | null>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pins = useMemo(() => {
    const out: Record<string, Pin> = {};
    for (const s of data?.stops ?? []) {
      if (s.id in edits) {
        const e = edits[s.id];
        if (e) out[s.id] = e;
        continue;
      }
      if (s.lat != null && s.lng != null) {
        const at = { lat: s.lat, lng: s.lng };
        out[s.id] = { ...at, pickup: s.pickup ?? passedAt(pickup, at, null), drop: s.drop ?? passedAt(drop, at, null), suggested: false, source: "Saved pin" };
        continue;
      }
      const sug = suggest.data?.find((x) => x.stopId === s.id);
      if (sug) {
        const at = { lat: sug.lat, lng: sug.lng };
        out[s.id] = { ...at, pickup: passedAt(pickup, at, null), drop: passedAt(drop, at, null), suggested: true, source: sug.source };
      }
    }
    return out;
  }, [data, edits, suggest.data, pickup, drop]);

  const stops = useMemo(
    () =>
      [...(data?.stops ?? [])].sort((a, b) => {
        const pa = pins[a.id]?.pickup || "99:99";
        const pb = pins[b.id]?.pickup || "99:99";
        return pa.localeCompare(pb) || a.name.localeCompare(b.name);
      }),
    [data, pins],
  );
  const order = new Map(stops.filter((s) => pins[s.id]).map((s, i) => [s.id, i + 1]));
  // Only confirmed pins are saved; a suggestion waits for a look.
  const placed = stops.filter((s) => pins[s.id] && !pins[s.id]!.suggested);
  const suggestedOnly = stops.filter((s) => pins[s.id]?.suggested);
  const missingTimes = placed.filter((s) => !pins[s.id]!.pickup || !pins[s.id]!.drop);

  const setPin = (stopId: string, at: { lat: number; lng: number }, pause: StopMapPause | null) =>
    setEdits((e) => ({
      ...e,
      [stopId]: { ...at, pickup: passedAt(pickup, at, pause), drop: passedAt(drop, at, null), suggested: false, source: pause ? "Placed on a pause" : "Placed on the map" },
    }));

  const canvasPins: CanvasPin[] = stops
    .filter((s) => pins[s.id])
    .map((s) => ({ stopId: s.id, n: order.get(s.id)!, name: s.name, lat: pins[s.id]!.lat, lng: pins[s.id]!.lng, suggested: pins[s.id]!.suggested }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/api/admin/stop-map/${routeId}`, {
        busId,
        date: day,
        trip: pickup?.key,
        stops: placed.map((s) => ({ stopId: s.id, lat: pins[s.id]!.lat, lng: pins[s.id]!.lng, pickup: pins[s.id]!.pickup, drop: pins[s.id]!.drop })),
      });
      setEdits({});
      await res.reload();
      dispatch({ type: "toast", message: `Saved ${placed.length} stops on ${data?.route.name}, in pickup order.` });
    } catch (err) {
      dispatch({ type: "toast", message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const selectedName = stops.find((s) => s.id === selected)?.name;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <SelectInput
          ariaLabel="Bus"
          className="!w-[150px]"
          value={busId}
          onChange={(v) => {
            setBus(v);
            setEdits({});
          }}
          options={(data?.buses ?? []).map((b) => ({ value: b.id, label: `Bus ${b.number}` }))}
          placeholder="Bus with a tracker"
        />
        <input
          type="date"
          aria-label="Day"
          value={day}
          max={localDate()}
          onChange={(e) => {
            if (!e.target.value) return;
            setDay(e.target.value);
            setEdits({});
          }}
          className="rounded-control border border-line bg-surface px-3 py-2 font-mono text-[12.5px]"
        />
        <SelectInput
          ariaLabel="Pickup trip"
          className="!w-[230px]"
          value={pickup?.key ?? ""}
          onChange={setPickupKey}
          options={trips.map((t) => ({ value: t.key, label: `Pickup: ${tripLabel(t)}` }))}
          placeholder="Pickup trip"
        />
        <SelectInput
          ariaLabel="Drop trip"
          className="!w-[230px]"
          value={drop?.key ?? ""}
          onChange={setDropKey}
          options={trips.map((t) => ({ value: t.key, label: `Drop: ${tripLabel(t)}` }))}
          placeholder="Drop trip"
        />
        <span className="text-[12px] text-faint">
          {res.loading ? "Loading the trip…" : res.error || (suggest.loading ? "Finding stops on OpenStreetMap…" : !trips.length && data ? "No trips that day." : "")}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="relative h-[620px] overflow-hidden rounded-card border border-line">
          <StopMapCanvas
            pickup={pickup}
            drop={drop}
            pins={canvasPins}
            selected={selected}
            onSelect={setSelected}
            onPlace={(at, pause) => selected && setPin(selected, pause ? at : onRoad(pickup, at), pause)}
            onMove={(id, at) => setPin(id, onRoad(pickup, at), null)}
          />
          <div className="absolute left-3 top-3 z-[500] max-w-[calc(100%-1.5rem)] rounded-control border border-line bg-surface px-3 py-2 text-[12px] text-muted">
            {selectedName ? (
              <>
                Click a grey pause or the road to place <span className="font-semibold text-ink">{selectedName}</span>.
              </>
            ) : (
              "Pick a stop in the list, then click where the bus stops for it. Drag a pin to move it."
            )}
          </div>
        </div>

        <Card className="flex max-h-[620px] min-h-0 flex-col overflow-hidden">
          <div className="border-b border-line-soft px-4 py-3">
            <div className="text-[13.5px] font-semibold">{data?.route.name ?? "Route"} · stops</div>
            <div className="mt-0.5 text-[11.5px] text-faint">
              <Mono>{placed.length}</Mono> of <Mono>{stops.length}</Mono> placed
              {suggestedOnly.length ? (
                <>
                  {" "}· <Mono>{suggestedOnly.length}</Mono> suggested
                </>
              ) : null}{" "}
              · ordered by pickup time
            </div>
            {suggestedOnly.length ? (
              <SecondaryButton
                className="mt-2 !px-2.5 !py-1.5 !text-[12px]"
                icon="done_all"
                onClick={() =>
                  setEdits((e) => {
                    const next = { ...e };
                    for (const s of suggestedOnly) next[s.id] = { ...pins[s.id]!, suggested: false, source: "Suggestion confirmed" };
                    return next;
                  })
                }
              >
                Confirm all {suggestedOnly.length} suggestions
              </SecondaryButton>
            ) : null}
          </div>
          <ol className="min-h-0 flex-1 overflow-auto">
            {stops.map((s) => {
              const pin = pins[s.id];
              const on = selected === s.id;
              return (
                <li key={s.id} className="border-b border-line-rule px-3 py-2.5" style={on ? { background: "#f7faff" } : undefined}>
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelected(on ? null : s.id)}
                      aria-pressed={on}
                      aria-label={`Place ${s.name}`}
                      className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold"
                      style={
                        pin
                          ? pin.suggested
                            ? { border: "2px dashed #16181b", color: "#16181b" }
                            : { background: "#16181b", color: "#fff" }
                          : { border: "1px solid #dadce0", color: "#8b919b" }
                      }
                    >
                      {pin ? order.get(s.id) : "·"}
                    </button>
                    <button type="button" onClick={() => setSelected(on ? null : s.id)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-[13px] font-semibold text-ink">{s.name}</div>
                      <div className="text-[11.5px] text-faint">
                        <Mono>{s.students}</Mono> student{s.students === 1 ? "" : "s"} · {pin ? pin.source : on ? "Click on the map to place" : "Not placed"}
                      </div>
                    </button>
                    {pin ? (
                      <button
                        type="button"
                        onClick={() => setEdits((e) => ({ ...e, [s.id]: null }))}
                        aria-label={`Remove ${s.name}'s pin`}
                        className="grid size-7 shrink-0 place-items-center rounded-chip text-faint hover:bg-canvas"
                      >
                        <Icon name="close" size={16} />
                      </button>
                    ) : null}
                  </div>
                  {pin ? (
                    <div className="mt-2 flex items-center gap-2 pl-[34px]">
                      {(["pickup", "drop"] as const).map((k) => (
                        <label key={k} className="flex items-center gap-1.5 text-[11px] text-faint">
                          {k === "pickup" ? "Pickup" : "Drop"}
                          <input
                            type="time"
                            value={pin[k]}
                            onChange={(e) => setEdits((ed) => ({ ...ed, [s.id]: { ...pin, [k]: e.target.value, suggested: false } }))}
                            className={`rounded-chip border bg-surface px-1.5 py-1 font-mono text-[12px] text-ink ${pin[k] ? "border-line" : "border-critical"}`}
                          />
                        </label>
                      ))}
                      {pin.suggested ? (
                        <SecondaryButton className="!px-2 !py-1 !text-[11.5px]" onClick={() => setEdits((e) => ({ ...e, [s.id]: { ...pin, suggested: false, source: "Suggestion confirmed" } }))}>
                          Confirm
                        </SecondaryButton>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <div className="border-t border-line-soft px-4 py-3">
            {missingTimes.length ? (
              <div className="mb-2 text-[11.5px] text-critical-text">
                Add pickup and drop times for {missingTimes.map((s) => s.name).join(", ")}.
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-[11px] text-faint">Suggestions © OpenStreetMap contributors. Check every pin.</span>
              <PrimaryButton icon="save" onClick={() => void save()} disabled={!placed.length || missingTimes.length > 0 || saving || !pickup}>
                {saving ? "Saving…" : `Save ${placed.length} stops`}
              </PrimaryButton>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
