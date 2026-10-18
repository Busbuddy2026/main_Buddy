"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { LiveRoute } from "@/lib/api/types";

/*
 * Live map. Draws what it is given: buses at their last GPS fix (from the
 * tracking vendor, via the live API), the road each has driven today (solid,
 * from the tracker's history) and planned route lines from the stops'
 * coordinates (dashed). It never invents a position; a bus without a fix is simply
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

/** The road a bus has driven today. `id` is the bus number, as on MapVehicle. */
export interface MapTrail {
  id: string;
  points: Array<{ lat: number; lng: number }>;
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

        // Driven today: solid, under everything else.
        for (const trail of driven) {
          const bus = shown.find((v) => v.id === trail.id);
          if (!bus) continue;
          const path = trail.points.map((p) => [p.lat, p.lng] as [number, number]);
          bounds.push(...path);
          const active = !sel || bus.id === sel;
          L.polyline(path, {
            color: "#1a73e8",
            weight: active ? 5 : 3,
            opacity: active ? 0.75 : 0.2,
            lineJoin: "round",
            lineCap: "round",
          })
            .addTo(layer)
            .bindTooltip(`Bus ${bus.id} · driven today`, { sticky: true });
        }

        // Planned route through the stops: dashed.
        for (const route of drawn) {
          const path = route.points.map((p) => [p.lat, p.lng] as [number, number]);
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
        const key = `${focusIds ?? "*"}|${shown.map((v) => v.id).join(",")}|${drawn.length}|${driven.length}`;
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
