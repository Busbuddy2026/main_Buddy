"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { LiveRoute } from "@/lib/api/types";

/*
 * Live map. Draws what it is given: buses at their last GPS fix (from the
 * tracking vendor, via the live API) and route lines from the stops'
 * coordinates. It never invents a position; a bus without a fix is simply
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

export interface LiveMapProps {
  vehicles?: MapVehicle[];
  routes?: LiveRoute[];
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

/** Where the map opens before any data: the school's city. */
const HOME: [number, number] = [17.44, 78.37];

export function LiveMap({
  vehicles = [],
  routes = [],
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
  const propsRef = useRef({ vehicles, routes, selected, focus, routeIds, mode, onSelect });

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
      }).setView(HOME, 12);
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        attribution: "© OpenStreetMap · © CARTO",
        maxZoom: 20,
      }).addTo(map);
      if (!mini) map.zoomControl.setPosition("bottomright");

      const layer = L.layerGroup().addTo(map);
      layerRef.current = layer;

      const paint = () => {
        const { vehicles: all, routes: lines, selected: sel, focus: focusIds, routeIds: onlyRoutes, mode: m, onSelect: onPick } =
          propsRef.current;
        const isMini = m === "mini";
        const wanted = focusIds ? focusIds.split(",").map((s) => s.trim()).filter(Boolean) : null;
        const shown = wanted ? all.filter((v) => wanted.includes(v.id)) : all;
        const routeSet = new Set(onlyRoutes ?? shown.map((v) => v.routeId).filter((r): r is string => !!r));
        const drawn = lines.filter((r) => routeSet.has(r.id));

        layer.clearLayers();
        const bounds: Array<[number, number]> = [];

        for (const route of drawn) {
          const path = route.points.map((p) => [p.lat, p.lng] as [number, number]);
          if (!path.length) continue;
          bounds.push(...path);
          const owner = shown.find((v) => v.routeId === route.id);
          const active = !sel || owner?.id === sel;
          L.polyline(path, {
            color: owner ? COLOR[owner.state] : "#1a73e8",
            weight: active ? 4 : 3,
            opacity: active ? 0.7 : 0.22,
            lineJoin: "round",
          }).addTo(layer);
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
          const turn = bus.heading ?? 0;
          const marker = L.marker([bus.lat, bus.lng], {
            icon: L.divIcon({
              className: "",
              iconSize: [58, 30],
              iconAnchor: [29, 15],
              html:
                `<div style="display:flex;align-items:center;gap:5px;padding:5px 9px 5px 6px;border-radius:999px;` +
                `background:${COLOR[bus.state]};color:#fff;font:600 12px/1 'DM Sans',system-ui;` +
                `box-shadow:0 2px 10px rgba(0,0,0,.28);` +
                `outline:${isSelected ? "3px solid rgba(26,115,232,.35)" : "none"};` +
                `opacity:${active ? 1 : 0.35};cursor:pointer;white-space:nowrap">` +
                `<span style="width:16px;height:16px;border-radius:4px;background:rgba(255,255,255,.28);` +
                `display:grid;place-items:center;font-size:9px;transform:rotate(${turn}deg)">▲</span>${bus.id}</div>`,
            }),
            zIndexOffset: isSelected ? 1000 : 0,
          }).addTo(layer);
          if (!isMini && onPick) marker.on("click", () => onPick(bus.id));
        }

        // Fit once per focus, so polling never fights the user's zoom.
        const key = `${focusIds ?? "*"}|${shown.map((v) => v.id).join(",")}|${drawn.length}`;
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
    propsRef.current = { vehicles, routes, selected, focus, routeIds, mode, onSelect };
    paintRef.current?.();
  }, [vehicles, routes, selected, focus, routeIds, mode, onSelect]);

  return <div ref={hostRef} className={`absolute inset-0 z-0 bg-[#e8eaed] ${className}`} />;
}

/** Live API bus → map marker. Buses without a fix are left off the map. */
export function toMapVehicles(
  buses: Array<{ number: string; routeId: string | null; state: string; fix: { lat: number; lng: number; heading: number | null } | null; trip: { delayMin: number } | null }>,
  delayThreshold = 5,
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
        b.state === "moving" && (b.trip?.delayMin ?? 0) > delayThreshold
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
