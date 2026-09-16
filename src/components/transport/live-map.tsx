"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";

/*
 * Stylised live map, ported from the prototype's `live-map.js`.
 *
 * The bus positions animate along their stop polylines so the screen reads as
 * "live" without a device feed. Production swaps the tile layer and this
 * animation for MapLibre GL + MapTiler tiles, OSRM geometry and the
 * `bus.location` socket event (README §5–6); the props stay the same.
 */

const STOPS = {
  kondapur: { name: "Kondapur Main Road", lat: 17.4615, lng: 78.3641 },
  botanical: { name: "Botanical Garden", lat: 17.4635, lng: 78.356 },
  greenvalley: { name: "Green Valley Apartments", lat: 17.4552, lng: 78.3583 },
  gachibowli: { name: "Gachibowli Crossroads", lat: 17.4401, lng: 78.3489 },
  madhapur: { name: "Madhapur Police Station", lat: 17.4483, lng: 78.3915 },
  hitec: { name: "HITEC City MMTS", lat: 17.4485, lng: 78.3808 },
  lanco: { name: "Lanco Hills", lat: 17.4192, lng: 78.382 },
  school: { name: "Bharath Vidya Mandir", lat: 17.4239, lng: 78.3374 },
} as const;

type StopKey = keyof typeof STOPS;

interface MapBus {
  id: string;
  status: "ontime" | "delayed" | "offline";
  pos: number;
  stops: StopKey[];
}

const ROUTE_BUSES: MapBus[] = [
  { id: "12", status: "ontime", pos: 0.42, stops: ["kondapur", "botanical", "greenvalley", "gachibowli", "school"] },
  { id: "08", status: "delayed", pos: 0.26, stops: ["gachibowli", "lanco", "school"] },
  { id: "21", status: "ontime", pos: 0.68, stops: ["madhapur", "hitec", "lanco", "school"] },
  { id: "04", status: "offline", pos: 0.12, stops: ["kondapur", "greenvalley", "school"] },
];

const COLOR: Record<MapBus["status"], string> = {
  ontime: "#1a73e8",
  delayed: "#f29900",
  offline: "#9aa0a6",
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function pointAt(path: Array<[number, number]>, t: number): [number, number] {
  if (path.length < 2) return path[0];
  const segments = path.length - 1;
  const s = Math.min(segments - 1, Math.floor(t * segments));
  const lt = t * segments - s;
  return [lerp(path[s][0], path[s + 1][0], lt), lerp(path[s][1], path[s + 1][1], lt)];
}

export interface LiveMapProps {
  /** Bus id to highlight; others dim. */
  selected?: string;
  /** Comma-separated bus ids to show exclusively. */
  focus?: string;
  /** `mini` disables panning, zooming and marker clicks. */
  mode?: "full" | "mini";
  /** Fired when a bus marker is clicked (full mode only). */
  onSelect?: (busId: string) => void;
  className?: string;
}

export function LiveMap({ selected, focus, mode = "full", onSelect, className = "" }: LiveMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const paintRef = useRef<((fit?: boolean) => void) | null>(null);

  // The animation loop reads the latest props through this ref so it never has
  // to be torn down and rebuilt when the selection changes.
  const propsRef = useRef({ selected, focus, mode, onSelect });

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const buses = ROUTE_BUSES.map((b) => ({ ...b }));

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
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        attribution: "© OpenStreetMap · © CARTO",
        maxZoom: 20,
      }).addTo(map);

      if (!mini) map.zoomControl.setPosition("bottomright");

      const layer = L.layerGroup().addTo(map);
      layerRef.current = layer;

      const paint = (fit = false) => {
        const { selected: sel, focus: focusIds, mode: m, onSelect: onPick } = propsRef.current;
        const isMini = m === "mini";
        const wanted = focusIds
          ? focusIds.split(",").map((s) => s.trim()).filter(Boolean)
          : null;
        const shown = wanted ? buses.filter((b) => wanted.includes(b.id)) : buses;

        layer.clearLayers();
        const all: Array<[number, number]> = [];

        for (const bus of shown) {
          const path = bus.stops.map((k) => [STOPS[k].lat, STOPS[k].lng] as [number, number]);
          all.push(...path);
          const active = !sel || sel === bus.id;

          L.polyline(path, {
            color: COLOR[bus.status],
            weight: active ? 4 : 3,
            opacity: active ? 0.75 : 0.22,
            lineJoin: "round",
          }).addTo(layer);

          bus.stops.forEach((k, i) => {
            const stop = STOPS[k];
            const last = i === bus.stops.length - 1;
            L.marker([stop.lat, stop.lng], {
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
              .bindTooltip(stop.name, { direction: "top", offset: [0, -8] });
          });

          const [lat, lng] = pointAt(path, bus.pos);
          const isSelected = sel === bus.id;
          const marker = L.marker([lat, lng], {
            icon: L.divIcon({
              className: "",
              iconSize: [58, 30],
              iconAnchor: [29, 15],
              html:
                `<div style="display:flex;align-items:center;gap:5px;padding:5px 9px 5px 6px;border-radius:999px;` +
                `background:${COLOR[bus.status]};color:#fff;font:600 12px/1 'DM Sans',system-ui;` +
                `box-shadow:0 2px 10px rgba(0,0,0,.28);` +
                `outline:${isSelected ? "3px solid rgba(26,115,232,.35)" : "none"};` +
                `opacity:${active ? 1 : 0.35};cursor:pointer;white-space:nowrap">` +
                `<span style="width:16px;height:16px;border-radius:4px;background:rgba(255,255,255,.28);` +
                `display:grid;place-items:center;font-size:9px">▲</span>${bus.id}</div>`,
            }),
            zIndexOffset: isSelected ? 1000 : 0,
          }).addTo(layer);

          if (!isMini && onPick) marker.on("click", () => onPick(bus.id));
        }

        if (fit && all.length) {
          map.fitBounds(L.latLngBounds(all), { padding: isMini ? [28, 28] : [56, 56] });
        }
      };

      paintRef.current = paint;
      paint(true);

      timer = setInterval(() => {
        for (const bus of buses) {
          if (bus.status === "offline") continue;
          bus.pos = (bus.pos + (bus.status === "delayed" ? 0.0012 : 0.0028)) % 1;
        }
        paint();
      }, 900);
    })();

    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      paintRef.current = null;
      layerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Publish the latest props, then repaint with them.
  useEffect(() => {
    propsRef.current = { selected, focus, mode, onSelect };
    paintRef.current?.();
  }, [selected, focus, mode, onSelect]);

  return <div ref={hostRef} className={`absolute inset-0 z-0 bg-[#e8eaed] ${className}`} />;
}
