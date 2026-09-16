"use client";

import { useState } from "react";
import { Dropdown, Icon, Mono } from "@/components/transport/ui";

/**
 * Live CCTV grid. Tiles are placeholders until the vendor's RTSP→HLS gateway is
 * connected; production mounts one `hls.js` player per visible tile, at most six
 * per page, and unmounts them on navigation (README §7). Every playback is
 * written to `AuditLog` as a `CCTV_VIEW`.
 */

const CAMERAS = (
  [
    ["12", "Front"], ["12", "Cabin"], ["12", "Door"],
    ["08", "Front"], ["08", "Cabin"], ["08", "Door"],
    ["21", "Front"], ["21", "Cabin"], ["21", "Door"],
  ] as const
).map(([bus, name]) => {
  const off = bus === "08" && name === "Door";
  return {
    id: `${bus}-${name}`,
    bus,
    name,
    off,
    label: off ? "OFFLINE" : "LIVE",
    dot: off ? "#9aa0a6" : "#d93025",
    fg: off ? "#9aa0a6" : "#fff",
    tint: off ? "#20232a" : "#2b2f36",
    foot: off ? "No stream since 6:58 AM" : "Recording · 1080p",
  };
});

const BUS_OPTIONS = ["All buses", "Bus 12", "Bus 08", "Bus 21"];
const VIEW_OPTIONS = ["All cameras", "Front camera", "Cabin camera", "Door camera"];

export default function LiveCctvPage() {
  const [bus, setBus] = useState("All buses");
  const [view, setView] = useState("All cameras");
  const [menu, setMenu] = useState<"" | "bus" | "view">("");

  const cams = CAMERAS.filter(
    (c) =>
      (bus === "All buses" || bus === `Bus ${c.bus}`) &&
      (view === "All cameras" || view === `${c.name} camera`),
  );

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Dropdown
          value={bus}
          options={BUS_OPTIONS}
          width={140}
          open={menu === "bus"}
          onToggle={() => setMenu((m) => (m === "bus" ? "" : "bus"))}
          onChange={(v) => {
            setBus(v);
            setMenu("");
          }}
        />
        <Dropdown
          value={view}
          options={VIEW_OPTIONS}
          width={165}
          open={menu === "view"}
          onToggle={() => setMenu((m) => (m === "view" ? "" : "view"))}
          onChange={(v) => {
            setView(v);
            setMenu("");
          }}
        />
        <Mono className="text-xs text-faint">
          {cams.length} of {CAMERAS.length} streams
        </Mono>
        <div className="flex-1" />
        <span className="text-xs text-faint">
          Streams are access-logged. Parents do not receive live footage.
        </span>
      </div>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))]">
        {cams.map((c) => (
          <div
            key={c.id}
            className="overflow-hidden rounded-[14px] border border-line bg-surface hover:border-[#c9ced6]"
          >
            <div
              className="relative grid aspect-[16/10] place-items-center"
              style={{ background: c.tint }}
            >
              <Icon name="videocam" size={34} style={{ color: "rgba(255,255,255,.28)" }} />
              <span
                className="absolute left-2.5 top-[9px] flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-[3px] text-[10px] font-bold tracking-[0.06em]"
                style={{ color: c.fg }}
              >
                <span className="size-1.5 rounded-full" style={{ background: c.dot }} />
                {c.label}
              </span>
              <Mono className="absolute bottom-[9px] right-2.5 text-[10.5px] text-white/60">
                07:42:18
              </Mono>
            </div>
            <div className="px-[13px] py-[11px]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-semibold">
                  Bus {c.bus} · {c.name}
                </div>
                <button
                  type="button"
                  aria-label={`Fullscreen Bus ${c.bus} ${c.name} camera`}
                  className="text-faint hover:text-ink-2"
                >
                  <Icon name="fullscreen" size={17} />
                </button>
              </div>
              <div className="mt-0.5 text-[11.5px] text-faint">{c.foot}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
