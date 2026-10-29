"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { captureSupported, useDashcamCapture } from "@/components/transport/dashcam-capture";
import { CameraFullscreen } from "@/components/transport/camera-fullscreen";
import { Icon, Mono, SecondaryButton } from "@/components/transport/ui";
import { VendorFrame, type CameraStream } from "@/components/transport/vendor-frame";
import { api, errorMessage } from "@/lib/api/client";

/**
 * Live dashcam for one bus, in the vendor's player (LivePin `player_v2`).
 * Starting it asks our API to start the stream, which writes the CCTV_VIEW
 * audit row before any video is returned.
 */

type Stream = CameraStream;

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Tab capture exists only in the browser, and not on phones. */
const noSubscribe = () => () => undefined;
const useCanCapture = () => useSyncExternalStore(noSubscribe, captureSupported, () => false);

function CameraTile({ stream, title, onFullscreen }: { stream: Stream; title: string; onFullscreen: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} onDoubleClick={onFullscreen} className="group relative aspect-video overflow-hidden rounded-[10px] bg-black">
      <VendorFrame stream={stream} title={title} width={width} />
      <div className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-chip bg-black/55 px-2 py-1 text-[11px] font-semibold text-white">
        <span className="size-1.5 rounded-full bg-critical" />
        <Mono>CAM {stream.channel}</Mono>
      </div>
      <button
        type="button"
        onClick={onFullscreen}
        aria-label={`Camera ${stream.channel} full screen`}
        title="Full screen (or double-click)"
        className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-chip bg-black/55 px-2 py-1.5 text-[11.5px] font-semibold text-white opacity-80 transition-opacity hover:bg-black/75 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Icon name="fullscreen" size={17} />
        Full screen
      </button>
    </div>
  );
}

export function DashcamPlayer({
  busUid,
  title,
  className = "",
  onRecording,
}: {
  busUid: string;
  title: string;
  className?: string;
  /** Seconds recorded so far, or null when not recording. */
  onRecording?: (seconds: number | null) => void;
}) {
  const [state, setState] = useState<{ streams?: Stream[]; error?: string }>({});
  const [attempt, setAttempt] = useState(0);
  const [full, setFull] = useState<number | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const capture = useDashcamCapture({ busUid, fileLabel: title, target: grid });
  const canCapture = useCanCapture();

  useEffect(() => {
    onRecording?.(capture.recording ? capture.seconds : null);
  }, [onRecording, capture.recording, capture.seconds]);

  useEffect(() => {
    let live = true;
    api
      .post<{ streams: Stream[] }>(`/api/admin/cctv/buses/${busUid}/stream`)
      .then((r) => live && setState({ streams: r.streams }))
      .catch((e: unknown) => live && setState({ error: errorMessage(e) }));
    return () => {
      live = false;
    };
  }, [busUid, attempt]);

  const streams = state.streams ?? [];
  const closeFull = useCallback(() => setFull(null), []);

  return (
    <div className={className}>
      {streams.length ? (
        <div ref={grid} className={`grid gap-2 ${streams.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {streams.map((s) => (
            <CameraTile key={s.channel} stream={s} title={title} onFullscreen={() => setFull(s.channel)} />
          ))}
        </div>
      ) : (
        <div className="grid aspect-video place-items-center rounded-[10px] bg-video px-6 text-center">
          <div>
            <Icon name={state.error ? "videocam_off" : "hourglass_top"} size={36} style={{ color: "rgba(255,255,255,.4)" }} />
            <div className="mt-2 text-[13px] text-white/80">{state.error ?? "Connecting to the cameras…"}</div>
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
      <div className="flex flex-wrap items-center gap-2 pt-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[11.5px] text-faint">
          <Icon name="lock" size={14} />
          Every view, screenshot and recording is logged in the audit trail.
        </div>
        {canCapture ? (
          <>
            <SecondaryButton icon="photo_camera" onClick={() => void capture.screenshot()} disabled={!streams.length || capture.busy}>
              Screenshot
            </SecondaryButton>
            {capture.recording ? (
              <button
                type="button"
                onClick={capture.stop}
                className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-control border border-critical bg-critical-tint px-[13px] py-[8px] text-[12.5px] font-semibold text-critical-text transition-colors hover:bg-surface"
              >
                <span className="size-2 animate-pulse rounded-full bg-critical" />
                Stop · <Mono>{clock(capture.seconds)}</Mono>
              </button>
            ) : (
              <SecondaryButton icon="radio_button_checked" onClick={() => void capture.record()} disabled={!streams.length || capture.busy}>
                Record
              </SecondaryButton>
            )}
          </>
        ) : null}
      </div>
      {full !== null && streams.length ? <CameraFullscreen streams={streams} start={full} title={title} busUid={busUid} onClose={closeFull} /> : null}
      {capture.error ? (
        <div role="alert" className="mt-2 rounded-control bg-critical-tint px-3 py-2 text-[12px] font-medium text-critical-text">
          {capture.error}
        </div>
      ) : null}
      {canCapture && !capture.recording ? (
        <div className="pt-1.5 text-[11px] text-faint">
          Files save to this computer. Your browser asks once to share this tab.
        </div>
      ) : null}
    </div>
  );
}

export function DashcamModal({ busUid, title, onClose }: { busUid: string; title: string; onClose: () => void }) {
  const [recorded, setRecorded] = useState<number | null>(null);
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
      className="fixed inset-0 z-[950] grid place-items-center overflow-y-auto bg-[rgba(16,24,40,0.62)] p-4 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[1200px] max-w-full overflow-hidden rounded-[18px] bg-surface"
        style={{ boxShadow: "var(--shadow-modal)" }}
      >
        <div className="flex items-center gap-3 border-b border-line-soft px-5 py-3.5">
          <Icon name="videocam" size={20} className="text-muted" />
          <div className="min-w-0 flex-1 text-[14.5px] font-semibold">{title}</div>
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-critical-tint px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-critical-text">
            <span className="size-1.5 animate-pulse rounded-full bg-critical" />
            {recorded === null ? "LIVE" : <Mono>REC {clock(recorded)}</Mono>}
          </span>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-chip hover:bg-canvas">
            <Icon name="close" size={19} />
          </button>
        </div>
        <DashcamPlayer busUid={busUid} title={title} className="p-4" onRecording={setRecorded} />
      </div>
    </div>
  );
}
