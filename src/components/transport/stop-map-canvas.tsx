"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { StopMapPause, StopMapTrip } from "@/lib/api/types";
import { formatTime } from "@/lib/time";

/**
 * The map on "Map stops from a trip": the pickup trip (solid) and the drop
 * trip (faded), every pause the bus made (grey dots, bigger the longer it
 * stood), and the stop pins: numbered in order, dashed while only suggested.
 * Pins drag; clicking a pause or the map places the selected stop.
 */

export interface CanvasPin {
  stopId: string;
  n: number;
  name: string;
  lat: number;
  lng: number;
  suggested: boolean;
}

interface Props {
  pickup: StopMapTrip | null;
  drop: StopMapTrip | null;
  pins: CanvasPin[];
  selected: string | null;
  onPlace: (at: { lat: number; lng: number }, pause: StopMapPause | null) => void;
  onMove: (stopId: string, at: { lat: number; lng: number }) => void;
  onSelect: (stopId: string) => void;
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export function StopMapCanvas(props: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const paintRef = useRef<(() => void) | null>(null);
  const propsRef = useRef(props);
  const fittedFor = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !hostRef.current || mapRef.current) return;
      const map = L.map(hostRef.current).setView([22.5, 79], 5);
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 }).addTo(map);
      map.zoomControl.setPosition("bottomright");
      const layer = L.layerGroup().addTo(map);
      layerRef.current = layer;
      map.on("click", (e) => propsRef.current.onPlace({ lat: e.latlng.lat, lng: e.latlng.lng }, null));

      const paint = () => {
        const { pickup, drop, pins, selected, onPlace, onMove, onSelect } = propsRef.current;
        layer.clearLayers();
        const bounds: Array<[number, number]> = [];

        if (drop && drop.key !== pickup?.key) {
          L.polyline(drop.points.map((p) => [p.lat, p.lng] as [number, number]), { color: "#5f6672", weight: 4, opacity: 0.35, dashArray: "1 8", lineCap: "round", interactive: false }).addTo(layer);
        }
        if (pickup) {
          const path = pickup.points.map((p) => [p.lat, p.lng] as [number, number]);
          bounds.push(...path);
          L.polyline(path, { color: "#1a73e8", weight: 5, opacity: 0.75, lineCap: "round", lineJoin: "round" })
            .addTo(layer)
            .on("click", (e) => {
              L.DomEvent.stopPropagation(e);
              onPlace({ lat: e.latlng.lat, lng: e.latlng.lng }, null);
            });
          for (const pause of pickup.pauses) {
            const mins = pause.durationS / 60;
            const size = mins >= 5 ? 16 : mins >= 1 ? 12 : 9;
            L.marker([pause.lat, pause.lng], {
              icon: L.divIcon({
                className: "",
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
                html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#9aa0a6;border:2px solid #fff;box-shadow:0 0 0 1px #5f6672;cursor:pointer"></div>`,
              }),
              zIndexOffset: 100,
            })
              .addTo(layer)
              .bindTooltip(
                `<div style="font:500 11.5px/1.4 var(--font-mono)">Paused ${mins < 1 ? `${Math.round(pause.durationS)} s` : `${Math.round(mins)} min`} · ${formatTime(new Date(pause.start))}</div>`,
                { direction: "top", offset: [0, -6] },
              )
              .on("click", (e) => {
                L.DomEvent.stopPropagation(e);
                onPlace({ lat: pause.lat, lng: pause.lng }, pause);
              });
          }
        }

        for (const pin of pins) {
          const on = pin.stopId === selected;
          const marker = L.marker([pin.lat, pin.lng], {
            draggable: true,
            icon: L.divIcon({
              className: "",
              iconSize: [24, 24],
              iconAnchor: [12, 12],
              html:
                `<div style="width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font:600 11px/1 var(--font-mono);cursor:grab;` +
                (pin.suggested ? "background:#fff;color:#16181b;border:2px dashed #16181b;" : "background:#16181b;color:#fff;border:2px solid #fff;") +
                (on ? "box-shadow:0 0 0 4px rgba(26,115,232,.45);" : "box-shadow:0 1px 3px rgba(0,0,0,.35);") +
                `">${pin.n}</div>`,
            }),
            zIndexOffset: on ? 1000 : 500,
          }).addTo(layer);
          marker.bindTooltip(`${escape(pin.name)}${pin.suggested ? " · suggested" : ""}`, { direction: "top", offset: [0, -12] });
          marker.on("click", () => onSelect(pin.stopId));
          marker.on("dragend", () => {
            const at = marker.getLatLng();
            onMove(pin.stopId, { lat: at.lat, lng: at.lng });
          });
        }

        const key = `${pickup?.key ?? ""}|${pickup?.start ?? ""}`;
        if (bounds.length > 1 && fittedFor.current !== key) {
          fittedFor.current = key;
          map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
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
    propsRef.current = props;
    paintRef.current?.();
  });

  return <div ref={hostRef} className="absolute inset-0 z-0 bg-[#e8eaed]" />;
}
