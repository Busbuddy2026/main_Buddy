"use client";

import { useState } from "react";
import { DashcamModal } from "@/components/transport/dashcam-modal";
import { Dropdown, Icon, Mono } from "@/components/transport/ui";
import { api, errorMessage } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { useStore } from "@/lib/transport/store";
import type { listCameras } from "@/server/services/safety";

/**
 * Live CCTV, one card per bus. Cameras and their health come from the
 * database. A bus with a linked LivePin dashcam opens all its channels
 * together in the vendor's player; each camera can also be opened on its
 * own. Cameras without a video source say so. Every open is written to
 * `AuditLog` as `CCTV_VIEW`.
 */

type Cameras = Awaited<ReturnType<typeof listCameras>>;
type Cam = Cameras["buses"][number]["cameras"][number];

const isDashcam = (c: Cam) => c.label.startsWith("Channel");

export default function LiveCctvPage() {
  const { dispatch } = useStore();
  const registry = useApi<Cameras>("/api/admin/cctv/cameras");
  const [bus, setBus] = useState("All buses");
  const [view, setView] = useState("All cameras");
  const [menu, setMenu] = useState<"" | "bus" | "view">("");
  const [watching, setWatching] = useState<{ busId: string; bus: string } | null>(null);

  const buses = registry.data?.buses ?? [];
  const total = buses.reduce((n, b) => n + b.cameras.length, 0);
  const busOptions = ["All buses", ...buses.map((b) => `Bus ${b.bus}`)];
  // The cameras actually fitted, by name ("Channel 1", "Cabin", …).
  const viewOptions = ["All cameras", ...[...new Set(buses.flatMap((b) => b.cameras.map((c) => `${c.label} camera`)))].sort()];
  const shown = buses
    .filter((b) => bus === "All buses" || bus === `Bus ${b.bus}`)
    .map((b) => ({ ...b, cameras: b.cameras.filter((c) => view === "All cameras" || view === `${c.label} camera`) }))
    .filter((b) => b.cameras.length);
  const shownCams = shown.reduce((n, b) => n + b.cameras.length, 0);

  const open = async (b: { busId: string; bus: string }, c: Cam) => {
    if (isDashcam(c)) {
      // The stream route writes the CCTV_VIEW audit row itself.
      setWatching({ busId: b.busId, bus: `Bus ${b.bus}` });
      return;
    }
    try {
      await api.post(`/api/admin/cctv/cameras/${c.id}/view`);
      dispatch({ type: "toast", message: `Bus ${b.bus} · ${c.label} has no live video source yet. This view was logged.` });
    } catch (error) {
      dispatch({ type: "toast", message: errorMessage(error) });
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Dropdown
          value={bus}
          options={busOptions}
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
          options={viewOptions}
          width={165}
          open={menu === "view"}
          onToggle={() => setMenu((m) => (m === "view" ? "" : "view"))}
          onChange={(v) => {
            setView(v);
            setMenu("");
          }}
        />
        <Mono className="text-xs text-faint">
          {shown.length} {shown.length === 1 ? "bus" : "buses"} · {shownCams} of {total} cameras
        </Mono>
        <div className="flex-1" />
        <span className="text-xs text-faint">
          Every view is access-logged. Parents do not receive live footage.
        </span>
      </div>

      {registry.data && total === 0 ? (
        <div className="rounded-card border border-dashed border-line px-6 py-14 text-center text-[13px] text-faint">
          No cameras registered yet.
        </div>
      ) : null}

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(360px,1fr))]">
        {shown.map((b) => {
          const dashcams = b.cameras.filter(isDashcam);
          const live = b.cameras.filter((c) => c.status === "ONLINE").length;
          const watchable = dashcams.length > 0;
          return (
            <div key={b.busId} className="overflow-hidden rounded-[14px] border border-line bg-surface hover:border-[#c9ced6]">
              <button
                type="button"
                disabled={!watchable}
                onClick={() => setWatching({ busId: b.busId, bus: `Bus ${b.bus}` })}
                aria-label={`Watch Bus ${b.bus} live`}
                className="relative block aspect-[16/8] w-full bg-[#20232a] disabled:cursor-default"
              >
                <div className="absolute inset-0 grid gap-px" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(b.cameras.length, 1), 2)}, 1fr)` }}>
                  {b.cameras.slice(0, 4).map((c) => (
                    <div key={c.id} className="relative grid place-items-center bg-[#2b2f36]">
                      {watchable ? null : (
                        <Icon name={c.status === "ONLINE" ? "videocam" : "videocam_off"} size={26} style={{ color: "rgba(255,255,255,.28)" }} />
                      )}
                      <span className="absolute bottom-2 left-2.5 font-mono text-[10.5px] text-white/60">{c.label}</span>
                    </div>
                  ))}
                </div>
                <span className="absolute left-2.5 top-[9px] flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-[3px] text-[10px] font-bold tracking-[0.06em] text-white">
                  <span className={`size-1.5 rounded-full ${live ? "bg-critical" : "bg-faint"}`} />
                  {live ? "LIVE" : "OFFLINE"}
                </span>
                {watchable ? (
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="flex items-center gap-1.5 rounded-pill bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink">
                      <Icon name="play_arrow" size={18} />
                      Watch {dashcams.length === 1 ? "live" : `all ${dashcams.length} channels`}
                    </span>
                  </span>
                ) : null}
              </button>
              <div className="px-[13px] py-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13.5px] font-semibold">Bus {b.bus}</div>
                  <Mono className="text-[11.5px] text-faint">
                    {live}/{b.cameras.length} live · seen {b.lastSeen}
                  </Mono>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {b.cameras.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => void open(b, c)}
                      aria-label={`Open Bus ${b.bus} ${c.label} camera`}
                      className="flex items-center gap-1.5 rounded-pill border border-line px-2.5 py-1 text-[12px] font-medium hover:bg-canvas"
                    >
                      <span className={`size-1.5 rounded-full ${c.status === "ONLINE" ? "bg-critical" : c.status === "OFFLINE" ? "bg-faint" : "bg-warning"}`} />
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-[11.5px] text-faint">
                  {watchable ? "LivePin dashcam · live only, recordings stay on the camera's memory card" : "No live video source"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {watching ? (
        <DashcamModal busUid={watching.busId} title={watching.bus} onClose={() => setWatching(null)} />
      ) : null}
    </div>
  );
}
