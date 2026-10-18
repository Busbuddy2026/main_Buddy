"use client";

import { useEffect, useState } from "react";
import { Icon, Mono } from "@/components/transport/ui";
import { api, errorMessage } from "@/lib/api/client";

/**
 * Live dashcam for one bus, in the vendor's player (LivePin `player_v2`).
 * Starting it asks our API to start the stream, which writes the CCTV_VIEW
 * audit row before any video is returned.
 */
const PLAYER_BAR_PX = 40;

function playerHeight(channels: number): string {
  const cols = channels > 1 ? 2 : 1;
  const rows = Math.ceil(channels / cols);
  return `calc(${((rows * 9) / (16 * cols)) * 100}% + ${channels > 0 ? PLAYER_BAR_PX : 0}px)`;
}

export function DashcamPlayer({ busUid, title, className = "" }: { busUid: string; title: string; className?: string }) {
  const [state, setState] = useState<{ url?: string; streams?: Array<{ channel: number; format: string }>; error?: string }>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    api
      .post<{ playerUrl: string; streams: Array<{ channel: number; format: string }> }>(`/api/admin/cctv/buses/${busUid}/stream`)
      .then((r) => live && setState({ url: r.playerUrl, streams: r.streams }))
      .catch((e: unknown) => live && setState({ error: errorMessage(e) }));
    return () => {
      live = false;
    };
  }, [busUid, attempt]);

  return (
    <div className={className}>
      {/* Sized to the player's layout: channels side by side (two per row), 16:9 each, plus its control bar. */}
      <div className="relative bg-video" style={{ paddingTop: playerHeight(state.streams?.length ?? 1) }}>
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
              {state.error ? (
                <button
                  type="button"
                  onClick={() => {
                    setState({});
                    setAttempt((n) => n + 1);
                  }}
                  className="mt-3 rounded-[9px] bg-white/15 px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-white/25"
                >
                  Try again
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
      <div className="px-1 pt-2 text-[11.5px] text-faint">
        {state.streams?.length ? (
          <>
            {state.streams.map((c) => (
              <span key={c.channel} className="mr-2 inline-flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-critical" />
                <Mono>Channel {c.channel} · {c.format}</Mono>
              </span>
            ))}
            ·{" "}
          </>
        ) : null}
        Every view is logged.
      </div>
    </div>
  );
}

export function DashcamModal({ busUid, title, onClose }: { busUid: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          <div className="min-w-0 flex-1 text-[14.5px] font-semibold">{title} · live dashcam</div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-chip hover:bg-canvas">
            <Icon name="close" size={19} />
          </button>
        </div>
        <DashcamPlayer busUid={busUid} title={title} className="pb-3 [&>div:last-child]:px-5" />
      </div>
    </div>
  );
}
