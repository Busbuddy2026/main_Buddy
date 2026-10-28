"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";

/**
 * Places on a map as circles, bigger for bigger values: where buses idle,
 * where they overspeed. Fits to the spots when they change; hover for detail.
 */

export interface Spot {
  lat: number;
  lng: number;
  /** Drives the circle's size, relative to the largest. */
  weight: number;
  /** Status colour from the tokens. */
  color: string;
  /** Tooltip; plain text, escaped here. */
  label: string;
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export function SpotsMap({ spots, className = "" }: { spots: Spot[]; className?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const paintRef = useRef<(() => void) | null>(null);
  const spotsRef = useRef(spots);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !hostRef.current || mapRef.current) return;
      const map = L.map(hostRef.current, { scrollWheelZoom: false }).setView([22.5, 79], 5);
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 }).addTo(map);
      map.zoomControl.setPosition("bottomright");
      const layer = L.layerGroup().addTo(map);
      layerRef.current = layer;
      let fitted = "";
      const paint = () => {
        const all = spotsRef.current;
        layer.clearLayers();
        const top = Math.max(1, ...all.map((s) => s.weight));
        for (const s of all) {
          L.circleMarker([s.lat, s.lng], {
            radius: 6 + 14 * Math.sqrt(s.weight / top),
            color: "#fff",
            weight: 2,
            fillColor: s.color,
            fillOpacity: 0.75,
          })
            .addTo(layer)
            .bindTooltip(`<div style="font:500 12px/1.4 var(--font-sans);white-space:pre-line">${escape(s.label)}</div>`, { direction: "top" });
        }
        const key = all.map((s) => `${s.lat},${s.lng}`).join("|");
        if (all.length && key !== fitted) {
          fitted = key;
          if (all.length === 1) map.setView([all[0]!.lat, all[0]!.lng], 15);
          else map.fitBounds(L.latLngBounds(all.map((s) => [s.lat, s.lng] as [number, number])), { padding: [36, 36], maxZoom: 15 });
        }
      };
      paintRef.current = paint;
      paint();
    })();
    return () => {
      disposed = true;
      paintRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    spotsRef.current = spots;
    paintRef.current?.();
  }, [spots]);

  return <div ref={hostRef} className={`absolute inset-0 z-0 bg-[#e8eaed] ${className}`} />;
}
