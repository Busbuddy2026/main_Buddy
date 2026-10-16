"use client";

import { useState } from "react";
import { DashcamModal } from "@/components/transport/dashcam-modal";
import { Dropdown, Icon, Mono } from "@/components/transport/ui";
import { api, errorMessage } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { useStore } from "@/lib/transport/store";
import type { listCameras } from "@/server/services/safety";

/**
 * Live CCTV grid. Cameras and their health come from the database. A bus with
 * a linked LivePin dashcam opens its live channels in the vendor's player;
 * other cameras have no video source yet. Every open is written to
 * `AuditLog` as `CCTV_VIEW`.
 */

type Cameras = Awaited<ReturnType<typeof listCameras>>;

const VIEW_OPTIONS = ["All cameras", "Channel 1 camera", "Channel 2 camera", "Front camera", "Cabin camera", "Door camera"];

export default function LiveCctvPage() {
  const { dispatch } = useStore();
  const registry = useApi<Cameras>("/api/admin/cctv/cameras");
  const [bus, setBus] = useState("All buses");
  const [view, setView] = useState("All cameras");
  const [menu, setMenu] = useState<"" | "bus" | "view">("");
  const [watching, setWatching] = useState<{ busId: string; bus: string } | null>(null);

  const all = (registry.data?.buses ?? []).flatMap((b) =>
    b.cameras.map((c) => {
      const off = c.status !== "ONLINE";
      return {
        id: c.id,
        busId: b.busId,
        dashcam: c.label.startsWith("Channel"),
        bus: b.bus,
        name: c.label,
        label: c.status === "ONLINE" ? "LIVE" : c.status === "OFFLINE" ? "OFFLINE" : "ISSUE",
        dot: off ? "#9aa0a6" : "#d93025",
        fg: off ? "#9aa0a6" : "#fff",
        tint: off ? "#20232a" : "#2b2f36",
        foot: c.label.startsWith("Channel")
          ? off ? `Dashcam offline · last seen ${c.lastSeen}` : "LivePin dashcam · tap to watch"
          : off ? `No stream · last seen ${c.lastSeen}` : "No live video source",
      };
    }),
  );
  const busOptions = ["All buses", ...(registry.data?.buses ?? []).map((b) => `Bus ${b.bus}`)];
  const cams = all.filter(
    (c) => (bus === "All buses" || bus === `Bus ${c.bus}`) && (view === "All cameras" || view === `${c.name} camera`),
  );

  const open = async (c: (typeof all)[number]) => {
    if (c.dashcam) {
      // The stream route writes the CCTV_VIEW audit row itself.
      setWatching({ busId: c.busId, bus: `Bus ${c.bus}` });
      return;
    }
    try {
      await api.post(`/api/admin/cctv/cameras/${c.id}/view`);
      dispatch({ type: "toast", message: `Bus ${c.bus} · ${c.name} has no live video source yet. This view was logged.` });
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
          {cams.length} of {all.length} cameras
        </Mono>
        <div className="flex-1" />
        <span className="text-xs text-faint">
          Every view is access-logged. Parents do not receive live footage.
        </span>
      </div>

      {registry.data && all.length === 0 ? (
        <div className="rounded-card border border-dashed border-line px-6 py-14 text-center text-[13px] text-faint">
          No cameras registered yet.
        </div>
      ) : null}

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))]">
        {cams.map((c) => (
          <div
            key={c.id}
            className="overflow-hidden rounded-[14px] border border-line bg-surface hover:border-[#c9ced6]"
          >
            <button
              type="button"
              onClick={() => void open(c)}
              className="relative grid aspect-[16/10] w-full place-items-center"
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
            </button>
            <div className="px-[13px] py-[11px]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-semibold">
                  Bus {c.bus} · {c.name}
                </div>
                <button
                  type="button"
                  onClick={() => void open(c)}
                  aria-label={`Open Bus ${c.bus} ${c.name} camera`}
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
      {watching ? (
        <DashcamModal busUid={watching.busId} title={watching.bus} onClose={() => setWatching(null)} />
      ) : null}
    </div>
  );
}
