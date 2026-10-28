"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { LiveRoute, TripAlert, TripAlertKind, TripStop } from "@/lib/api/types";
import { formatTime } from "@/lib/time";

/*
 * Live map. Draws what it is given: buses at their last GPS fix (from the
 * tracking vendor, via the live API), each bus's trip (solid, from the
 * tracker's history: the running trip, or the last one faded) with the stops
 * the vendor recorded on it (numbered), a green pin where it started and a
 * red one where it ended (none while running: the bus is the end), and
 * planned route lines from the
 * stops' coordinates (dashed). It never invents a position; a bus without a fix is simply
 * not drawn. Fits to its content on first paint and when the focus changes,
 * not on every poll, so the user's pan and zoom stick.
 */

export interface MapVehicle {
  /** Bus number, shown on the marker. */
  id: string;
  lat: number;
  lng: number;
  heading: number | null;
  state: "moving" | "idle" | "stopped" | "offline" | "delayed";
  routeId?: string | null;
}

const COLOR: Record<MapVehicle["state"], string> = {
  moving: "#1a73e8",
  delayed: "#f29900",
  idle: "#1e8e3e",
  stopped: "#5f6672",
  offline: "#9aa0a6",
};

/** A trip a bus has driven. `id` is the bus number, as on MapVehicle. */
export interface MapTrail {
  id: string;
  points: Array<{ lat: number; lng: number }>;
  /** "Trip A". */
  label?: string;
  /** A finished trip: drawn lighter than a running one. */
  faded?: boolean;
  stops?: TripStop[];
  /** Where and when the trip started and ended; `end` is null while running. */
  ends?: { start: string; end: string | null; from: string | null; to: string | null };
  /** Tracker alerts raised on the trip, drawn where they happened. */
  alerts?: TripAlert[];
}

/** Map icon per alert kind: colour by status, Material Symbols glyph. */
export const ALERT_STYLE: Record<TripAlertKind, { color: string; icon: string; name: string }> = {
  overspeed: { color: "#f29900", icon: "speed", name: "Overspeed" },
  engine_on: { color: "#1e8e3e", icon: "power_settings_new", name: "Engine on" },
  engine_off: { color: "#5f6672", icon: "power_off", name: "Engine off" },
  emergency: { color: "#d93025", icon: "warning", name: "SOS, power cut or tamper" },
  power: { color: "#8f5b00", icon: "battery_alert", name: "Low power" },
  other: { color: "#9aa0a6", icon: "notifications", name: "Other alert" },
};

function alertHtml(kind: TripAlertKind): string {
  const s = ALERT_STYLE[kind];
  return (
    `<div style="width:24px;height:24px;border-radius:50%;background:${s.color};border:2px solid #fff;display:grid;place-items:center;` +
    `box-shadow:0 1px 3px rgba(0,0,0,.3)"><span class="material-symbols-rounded" style="font-size:15px;line-height:1;color:#fff">${s.icon}</span></div>`
  );
}

function alertTooltip(a: TripAlert): string {
  return (
    `<div style="font:600 12px/1.4 var(--font-sans)">${escape(ALERT_STYLE[a.kind].name === "Other alert" ? a.label : ALERT_STYLE[a.kind].name)}</div>` +
    `<div style="font:500 11.5px/1.4 var(--font-mono)">${clock(a.at)}</div>` +
    (a.description ? `<div style="max-width:220px;white-space:normal;font:400 11.5px/1.4 var(--font-sans);color:#5f6672">${escape(a.description)}</div>` : "")
  );
}

const PIN_COLOR = { start: "#1e8e3e", end: "#d93025" } as const;

/** A map pin (Material "location_on" shape) with a white dot. */
function pinHtml(color: string): string {
  return (
    `<svg width="20" height="25" viewBox="0 0 24 30" style="display:block;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))">` +
    `<path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.4 12 30 12 30s12-9.6 12-18.3C24 5.2 18.6 0 12 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>` +
    `<circle cx="12" cy="11.5" r="4.2" fill="#fff"/></svg>`
  );
}

function pinTooltip(title: string, at: string | null, address: string | null): string {
  return (
    `<div style="font:600 12px/1.4 var(--font-sans)">${title}</div>` +
    (at ? `<div style="font:500 11.5px/1.4 var(--font-mono)">${clock(at)}</div>` : "") +
    (address ? `<div style="max-width:220px;white-space:normal;font:400 11.5px/1.4 var(--font-sans);color:#5f6672">${escape(address)}</div>` : "")
  );
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

const clock = (iso: string) => formatTime(new Date(iso));

function stopTooltip(n: number, s: TripStop): string {
  const span = s.end ? `${clock(s.start)} – ${clock(s.end)}` : `Since ${clock(s.start)}`;
  const mins = Math.max(1, Math.round(s.durationS / 60));
  return (
    `<div style="font:600 12px/1.4 var(--font-sans)">Stop ${n}</div>` +
    `<div style="font:500 11.5px/1.4 var(--font-mono)">${span} · ${mins} min</div>` +
    (s.address ? `<div style="max-width:220px;white-space:normal;font:400 11.5px/1.4 var(--font-sans);color:#5f6672">${escape(s.address)}</div>` : "")
  );
}

export interface LiveMapProps {
  vehicles?: MapVehicle[];
  routes?: LiveRoute[];
  trails?: MapTrail[];
  /** Bus id to highlight; others dim. */
  selected?: string;
  /** Comma-separated bus ids to show exclusively. */
  focus?: string;
  /** Route ids to draw; default: the routes of the buses shown. */
  routeIds?: string[];
  /** `mini` disables panning, zooming and marker clicks. */
  mode?: "full" | "mini";
  /** Fired when a bus marker is clicked (full mode only). */
  onSelect?: (busId: string) => void;
  className?: string;
}

/** Before any bus or stop is on the map: the whole country, no city assumed. The first data fits the view. */
const HOME: [number, number] = [22.5, 79];

export function LiveMap({
  vehicles = [],
  routes = [],
  trails = [],
  selected,
  focus,
  routeIds,
  mode = "full",
  onSelect,
  className = "",
}: LiveMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const paintRef = useRef<(() => void) | null>(null);
  const fittedFor = useRef<string | null>(null);
  const propsRef = useRef({ vehicles, routes, trails, selected, focus, routeIds, mode, onSelect });

  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !hostRef.current || mapRef.current) return;

      const mini = propsRef.current.mode === "mini";
      const map = L.map(hostRef.current, {
        zoomControl: !mini,
        attributionControl: true,
        dragging: !mini,
        scrollWheelZoom: !mini,
        doubleClickZoom: !mini,
        keyboard: !mini,
      }).setView(HOME, 5);
      mapRef.current = map;

      // CARTO's free basemaps now need an API key; OSM's standard tiles do not.
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      if (!mini) map.zoomControl.setPosition("bottomright");

      const layer = L.layerGroup().addTo(map);
      layerRef.current = layer;

      const paint = () => {
        const { vehicles: all, routes: lines, trails: driven, selected: sel, focus: focusIds, routeIds: onlyRoutes, mode: m, onSelect: onPick } =
          propsRef.current;
        const isMini = m === "mini";
        const wanted = focusIds ? focusIds.split(",").map((s) => s.trim()).filter(Boolean) : null;
        const shown = wanted ? all.filter((v) => wanted.includes(v.id)) : all;
        const routeSet = new Set(onlyRoutes ?? shown.map((v) => v.routeId).filter((r): r is string => !!r));
        const drawn = lines.filter((r) => routeSet.has(r.id));

        layer.clearLayers();
        const bounds: Array<[number, number]> = [];

        // Each bus's trip: solid, under everything else; a finished one lighter.
        for (const trail of driven) {
          const bus = shown.find((v) => v.id === trail.id);
          if (!bus) continue;
          const path = trail.points.map((p) => [p.lat, p.lng] as [number, number]);
          bounds.push(...path);
          const active = !sel || bus.id === sel;
          const what = trail.label ? `${trail.label}${trail.faded ? " · last trip" : " · running"}` : "driven today";
          L.polyline(path, {
            color: "#1a73e8",
            weight: active ? 5 : 3,
            opacity: !active ? 0.15 : trail.faded ? 0.38 : 0.8,
            dashArray: trail.faded ? "1 9" : undefined,
            lineJoin: "round",
            lineCap: "round",
          })
            .addTo(layer)
            .bindTooltip(`Bus ${escape(bus.id)} · ${escape(what)}`, { sticky: true });
          if (!active) continue;
          (trail.stops ?? []).forEach((stop, i) => {
            if (stop.lat == null || stop.lng == null) return;
            L.marker([stop.lat, stop.lng], {
              icon: L.divIcon({
                className: "",
                iconSize: [20, 20],
                iconAnchor: [10, 10],
                html:
                  `<div style="width:20px;height:20px;border-radius:50%;background:#16181b;border:2px solid #fff;color:#fff;` +
                  `display:grid;place-items:center;font:600 10.5px/1 var(--font-mono);opacity:${trail.faded ? 0.7 : 1}">${i + 1}</div>`,
              }),
              zIndexOffset: 500,
            })
              .addTo(layer)
              .bindTooltip(stopTooltip(i + 1, stop), { direction: "top", offset: [0, -10] });
          });
          for (const a of trail.alerts ?? []) {
            L.marker([a.lat, a.lng], {
              icon: L.divIcon({ className: "", iconSize: [24, 24], iconAnchor: [12, 12], html: alertHtml(a.kind) }),
              zIndexOffset: 550,
            })
              .addTo(layer)
              .bindTooltip(alertTooltip(a), { direction: "top", offset: [0, -12] });
          }
          // Start (green) and drop (red) pins; a running trip ends at the bus itself.
          const first = trail.points[0];
          const last = trail.points[trail.points.length - 1];
          const name = trail.label ?? "Trip";
          const pins: Array<[keyof typeof PIN_COLOR, { lat: number; lng: number } | undefined, string]> = [
            ["start", first, pinTooltip(`${escape(name)} · start`, trail.ends?.start ?? null, trail.ends?.from ?? null)],
          ];
          if (trail.faded) pins.push(["end", last, pinTooltip(`${escape(name)} · drop`, trail.ends?.end ?? null, trail.ends?.to ?? null)]);
          for (const [kind, at, tip] of pins) {
            if (!at) continue;
            L.marker([at.lat, at.lng], {
              icon: L.divIcon({ className: "", iconSize: [20, 25], iconAnchor: [10, 24], html: pinHtml(PIN_COLOR[kind]) }),
              zIndexOffset: 600,
            })
              .addTo(layer)
              .bindTooltip(tip, { direction: "top", offset: [0, -23] });
          }
        }

        // Planned route through the stops: dashed.
        for (const route of drawn) {
          // Along the road when the route was mapped from a real trip; else stop to stop.
          const path = (route.line && route.line.length > 1 ? route.line : route.points).map((p) => [p.lat, p.lng] as [number, number]);
          if (!path.length) continue;
          bounds.push(...path);
          const owner = shown.find((v) => v.routeId === route.id);
          const active = !sel || owner?.id === sel;
          L.polyline(path, {
            color: "#1a1c1e",
            weight: active ? 3 : 2,
            opacity: active ? 0.65 : 0.2,
            dashArray: "6 7",
            lineJoin: "round",
          })
            .addTo(layer)
            .bindTooltip(`${route.name} · planned route`, { sticky: true });
          route.points.forEach((p, i) => {
            const last = i === route.points.length - 1;
            L.marker([p.lat, p.lng], {
              icon: L.divIcon({
                className: "",
                iconSize: [14, 14],
                iconAnchor: [7, 7],
                html:
                  `<div style="width:14px;height:14px;border-radius:50%;background:#fff;border:3px solid ` +
                  `${last ? "#1a1c1e" : "#5f6672"};opacity:${active ? 1 : 0.3}"></div>`,
              }),
            })
              .addTo(layer)
              .bindTooltip(p.name, { direction: "top", offset: [0, -8] });
          });
        }

        for (const bus of shown) {
          bounds.push([bus.lat, bus.lng]);
          const active = !sel || sel === bus.id;
          const isSelected = sel === bus.id;
          const offline = bus.state === "offline";
          // The artwork faces west (left); rotate it to the heading, north when unknown.
          const turn = (bus.heading ?? 0) + 90;
          const w = isMini ? 46 : 56;
          const marker = L.marker([bus.lat, bus.lng], {
            icon: L.divIcon({
              className: "",
              iconSize: [64, 64],
              iconAnchor: [32, 32],
              html:
                `<div style="position:relative;width:64px;height:64px;cursor:pointer;opacity:${active ? 1 : 0.4}">` +
                (isSelected
                  ? `<div style="position:absolute;inset:6px;border-radius:50%;background:rgba(26,115,232,.16);border:2px solid rgba(26,115,232,.55)"></div>`
                  : "") +
                `<img src="/bus-top.png" alt="" draggable="false" style="position:absolute;left:50%;top:50%;width:${w}px;height:${Math.round(w * 0.4)}px;` +
                `max-width:none;transform:translate(-50%,-50%) rotate(${turn}deg);transition:transform .6s ease;` +
                `filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))${offline ? " grayscale(1)" : ""}" />` +
                `<div style="position:absolute;left:50%;top:100%;transform:translate(-50%,-10px);display:flex;align-items:center;gap:4px;` +
                `padding:2px 7px;border-radius:999px;background:#fff;border:1px solid #dadce0;white-space:nowrap;` +
                `font:600 11px/1.35 var(--font-mono);color:#16181b">` +
                `<span style="width:7px;height:7px;border-radius:50%;background:${COLOR[bus.state]}"></span>${bus.id}</div>` +
                `</div>`,
            }),
            zIndexOffset: isSelected ? 1000 : 0,
          }).addTo(layer);
          if (!isMini && onPick) marker.on("click", () => onPick(bus.id));
        }

        // Fit once per focus, so polling never fights the user's zoom.
        const key = `${focusIds ?? "*"}|${shown.map((v) => v.id).join(",")}|${drawn.length}|${driven.map((t) => `${t.id}:${t.label ?? ""}`).join(",")}`;
        if (bounds.length && fittedFor.current !== key) {
          fittedFor.current = key;
          if (bounds.length === 1) map.setView(bounds[0]!, 15);
          else map.fitBounds(L.latLngBounds(bounds), { padding: isMini ? [28, 28] : [56, 56], maxZoom: 16 });
        }
      };

      paintRef.current = paint;
      paint();
    })();

    return () => {
      disposed = true;
      paintRef.current = null;
      layerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    propsRef.current = { vehicles, routes, trails, selected, focus, routeIds, mode, onSelect };
    paintRef.current?.();
  }, [vehicles, routes, trails, selected, focus, routeIds, mode, onSelect]);

  return <div ref={hostRef} className={`absolute inset-0 z-0 bg-[#e8eaed] ${className}`} />;
}

/** Live API bus → map marker. Buses without a fix are left off the map. */
export function toMapVehicles(
  buses: Array<{ number: string; routeId: string | null; state: string; fix: { lat: number; lng: number; heading: number | null } | null; trip: { delayed: boolean } | null }>,
): MapVehicle[] {
  return buses
    .filter((b) => b.fix)
    .map((b) => ({
      id: b.number,
      lat: b.fix!.lat,
      lng: b.fix!.lng,
      heading: b.fix!.heading,
      routeId: b.routeId,
      state:
        b.state === "moving" && b.trip?.delayed
          ? "delayed"
          : (b.state as MapVehicle["state"]) === "offline" || b.state === "unlinked"
            ? "offline"
            : (b.state as MapVehicle["state"]),
    }));
}

/** One bus's live data (crew and parent apps) → map props. */
export function oneBusMap(label: string, live: { lat: number; lng: number; heading: number | null; speed: number; offline: boolean; route: Array<{ lat: number; lng: number; name: string }> } | null) {
  if (!live) return { vehicles: [] as MapVehicle[], routes: [] as LiveRoute[], routeIds: [] as string[] };
  return {
    vehicles: [
      {
        id: label,
        lat: live.lat,
        lng: live.lng,
        heading: live.heading,
        state: (live.offline ? "offline" : live.speed > 3 ? "moving" : "stopped") as MapVehicle["state"],
        routeId: "route",
      },
    ],
    routes: [{ id: "route", name: "Route", points: live.route }],
    routeIds: ["route"],
  };
}

/** Key to the trip symbols, for maps that draw trips. Lists only the alert kinds on the map. */
export function MapLegend({ trails, className = "" }: { trails: MapTrail[]; className?: string }) {
  const kinds = (Object.keys(ALERT_STYLE) as TripAlertKind[]).filter((k) => trails.some((t) => t.alerts?.some((a) => a.kind === k)));
  if (!trails.length) return null;
  const item = "flex items-center gap-1.5 whitespace-nowrap";
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-1.5 rounded-control border border-line bg-surface px-3 py-2 text-[11.5px] text-muted ${className}`}>
      <span className={item}><span className="size-2.5 rounded-full" style={{ background: "#1e8e3e" }} />Start</span>
      <span className={item}><span className="size-2.5 rounded-full" style={{ background: "#d93025" }} />Drop</span>
      <span className={item}><span className="grid size-4 place-items-center rounded-full bg-ink font-mono text-[9px] font-semibold text-white">1</span>Stop</span>
      {kinds.map((k) => (
        <span key={k} className={item}>
          <span className="grid size-4 place-items-center rounded-full" style={{ background: ALERT_STYLE[k].color }}>
            <span className="material-symbols-rounded text-white" style={{ fontSize: 11, lineHeight: 1 }}>{ALERT_STYLE[k].icon}</span>
          </span>
          {ALERT_STYLE[k].name}
        </span>
      ))}
    </div>
  );
}
