"use client";

import { useEffect, useState } from "react";
import { Icon, Mono } from "@/components/transport/ui";
import { api, errorMessage } from "@/lib/api/client";

/**
 * Live dashcam for one bus, in the vendor's player (LivePin `player_v2`).
 * Opening it asks our API to start the stream, which is written to the audit
 * log as a CCTV view before any video is returned.
 */
export function DashcamModal({ busUid, title, onClose }: { busUid: string; title: string; onClose: () => void }) {
  const [state, setState] = useState<{ url?: string; channels?: number; error?: string }>({});

  useEffect(() => {
    let live = true;
    api
      .post<{ playerUrl: string; channels: number }>(`/api/admin/cctv/buses/${busUid}/stream`)
      .then((r) => live && setState({ url: r.playerUrl, channels: r.channels }))
      .catch((e: unknown) => live && setState({ error: errorMessage(e) }));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      live = false;
      document.removeEventListener("keydown", onKey);
    };
  }, [busUid, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} live camera`}
      onClick={onClose}
      className="fixed inset-0 z-[950] grid place-items-center bg-[rgba(16,24,40,0.62)] p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[1040px] max-w-full overflow-hidden rounded-[18px] bg-surface"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        <div className="flex items-center gap-3 border-b border-line-soft px-5 py-3.5">
          <Icon name="videocam" size={20} className="text-muted" />
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] font-semibold">{title} · live dashcam</div>
            <div className="text-[11.5px] text-faint">
              {state.channels ? <Mono>{state.channels} channels</Mono> : "Starting the stream…"} · this view is logged
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-chip hover:bg-canvas">
            <Icon name="close" size={19} />
          </button>
        </div>
        <div className="relative aspect-video bg-video">
          {state.url ? (
            <iframe
              title={`${title} dashcam`}
              src={state.url}
              allow="autoplay; fullscreen"
              allowFullScreen
              className="absolute inset-0 size-full border-0"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center px-6 text-center">
              <div>
                <Icon name={state.error ? "videocam_off" : "hourglass_top"} size={36} style={{ color: "rgba(255,255,255,.4)" }} />
                <div className="mt-2 text-[13px] text-white/80">{state.error ?? "Connecting to the camera…"}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
