"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { captureSupported, useDashcamCapture } from "@/components/transport/dashcam-capture";
import { Spinner } from "@/components/transport/skeleton";
import { Icon, Mono } from "@/components/transport/ui";
import { VendorFrame, type CameraStream } from "@/components/transport/vendor-frame";

/**
 * One camera across the whole screen. Swipe or drag sideways, the arrows or
 * ←/→ to change camera; zoom with the buttons, the wheel or a pinch, and drag
 * to look around when zoomed. Screenshot and Record capture what is on screen,
 * cropped to the video. Controls fade after a few still seconds. Every
 * camera's stream stays connected, so switching is instant.
 */

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const SWIPE_PX = 60;
const IDLE_MS = 2800;

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const noSubscribe = () => () => undefined;
const useCanCapture = () => useSyncExternalStore(noSubscribe, captureSupported, () => false);

export function CameraFullscreen({
  streams,
  start,
  title,
  busUid,
  onClose,
}: {
  streams: CameraStream[];
  /** Channel to open on. */
  start: number;
  title: string;
  busUid: string;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  /** The video's own box: what screenshots and recordings capture. */
  const video = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() => Math.max(0, streams.findIndex((s) => s.channel === start)));
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });
  const [awake, setAwake] = useState(true);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const idleTimer = useRef<number | undefined>(undefined);
  const stream = streams[index]!;
  const capture = useDashcamCapture({ busUid, fileLabel: `${title} cam ${stream.channel}`, target: video });
  const canCapture = useCanCapture();

  // The video fills the screen at 16:9, letterboxed.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setBox({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = useMemo(
    () => (box.w && box.h ? (box.w / box.h > 16 / 9 ? { w: Math.floor((box.h * 16) / 9), h: box.h } : { w: box.w, h: Math.floor((box.w * 9) / 16) }) : null),
    [box.w, box.h],
  );

  // The browser's own full screen; leaving it (Esc) closes the viewer.
  useEffect(() => {
    const el = root.current;
    let entered = false;
    el?.requestFullscreen?.().then(() => (entered = true)).catch(() => undefined);
    const onChange = () => {
      if (entered && !document.fullscreenElement) onClose();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose]);

  const clamp = useCallback(
    (scale: number, x: number, y: number) => {
      const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
      if (!fit || s === 1) return { scale: s, x: 0, y: 0 };
      const mx = ((s - 1) * fit.w) / 2;
      const my = ((s - 1) * fit.h) / 2;
      return { scale: s, x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
    },
    [fit],
  );
  const zoomBy = useCallback((factor: number) => setZoom((z) => clamp(z.scale * factor, z.x * factor, z.y * factor)), [clamp]);
  const resetZoom = () => setZoom({ scale: 1, x: 0, y: 0 });

  const go = useCallback(
    (step: number) => {
      if (streams.length < 2) return;
      setIndex((i) => (i + step + streams.length) % streams.length);
      setZoom({ scale: 1, x: 0, y: 0 });
    },
    [streams.length],
  );

  const wake = useCallback(() => {
    setAwake(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setAwake(false), IDLE_MS);
  }, []);
  useEffect(() => {
    idleTimer.current = window.setTimeout(() => setAwake(false), IDLE_MS);
    return () => window.clearTimeout(idleTimer.current);
  }, []);

  // Keys: Esc closes (when the browser is not handling full screen), ←/→ change camera, +/−/0 zoom.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        if (!document.fullscreenElement) onClose();
      } else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") zoomBy(1.25);
      else if (e.key === "-") zoomBy(0.8);
      else if (e.key === "0") resetZoom();
      else return;
      wake();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [go, zoomBy, onClose, wake]);

  // Wheel and trackpad pinch zoom; needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025)));
      wake();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy, wake]);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: zoom.x, oy: zoom.y, moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    wake();
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    if (zoom.scale > 1) setZoom((z) => clamp(z.scale, d.ox + dx, d.oy + dy));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d || zoom.scale > 1) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1);
  };

  const chrome = `transition-opacity duration-300 ${awake || capture.recording ? "opacity-100" : "pointer-events-none opacity-0"}`;
  const roundBtn = "grid size-10 place-items-center rounded-full bg-white/12 text-white backdrop-blur hover:bg-white/22 disabled:opacity-40";

  return (
    <div ref={root} role="dialog" aria-modal="true" aria-label={`${title} camera ${stream.channel}, full screen`} className="fixed inset-0 z-[1300] flex flex-col bg-black text-white" onPointerMove={wake}>
      <div
        ref={stage}
        className={`relative flex-1 overflow-hidden ${zoom.scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"} touch-none select-none`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
        onDoubleClick={() => (zoom.scale > 1 ? resetZoom() : setZoom(clamp(2, 0, 0)))}
      >
        {fit ? (
          <div ref={video} className="absolute left-1/2 top-1/2 overflow-hidden" style={{ width: fit.w, height: fit.h, transform: "translate(-50%, -50%)" }}>
            {/* Every camera stays mounted and connected; only the chosen one shows. */}
            {streams.map((s, i) => (
              <div
                key={s.channel}
                className="absolute inset-0 overflow-hidden"
                style={{
                  opacity: i === index ? 1 : 0,
                  transform: i === index ? `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` : undefined,
                  transition: dragging ? "none" : "transform 120ms ease-out, opacity 200ms ease",
                }}
              >
                <div className="absolute inset-0 grid place-items-center text-white/40">
                  <Spinner size={28} />
                </div>
                <VendorFrame stream={s} title={title} width={fit.w} />
              </div>
            ))}
          </div>
        ) : null}

        {streams.length > 1 ? (
          <>
            <button type="button" aria-label="Previous camera" onClick={() => go(-1)} className={`absolute left-4 top-1/2 -translate-y-1/2 ${roundBtn} ${chrome}`}>
              <Icon name="chevron_left" size={26} />
            </button>
            <button type="button" aria-label="Next camera" onClick={() => go(1)} className={`absolute right-4 top-1/2 -translate-y-1/2 ${roundBtn} ${chrome}`}>
              <Icon name="chevron_right" size={26} />
            </button>
          </>
        ) : null}

        {/* Top bar */}
        <div className={`pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/75 to-transparent px-5 pb-10 pt-4 ${chrome}`}>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">{title}</div>
            <div className="text-[12px] text-white/70">
              Camera <Mono>{stream.channel}</Mono> of <Mono>{streams.length}</Mono>
              {streams.length > 1 ? " · swipe or use ← → to switch" : ""}
            </div>
          </div>
          {capture.recording ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-critical px-3 py-1 text-[12px] font-semibold">
              <span className="size-2 animate-pulse rounded-full bg-white" />
              <Mono>REC {clock(capture.seconds)}</Mono>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-3 py-1 text-[12px] font-semibold">
              <span className="size-2 animate-pulse rounded-full bg-critical" />
              LIVE
            </span>
          )}
          <button type="button" aria-label="Close full screen" onClick={onClose} className={`pointer-events-auto ${roundBtn}`}>
            <Icon name="close" size={22} />
          </button>
        </div>

        {/* Bottom bar */}
        <div className={`absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent px-5 pb-5 pt-12 ${chrome}`}>
          <div className="flex items-center gap-1.5">
            {streams.map((s, i) => (
              <button
                key={s.channel}
                type="button"
                aria-pressed={i === index}
                onClick={() => {
                  setIndex(i);
                  resetZoom();
                }}
                className={`rounded-pill px-3 py-1.5 font-mono text-[12px] font-semibold ${i === index ? "bg-white text-black" : "bg-white/12 text-white hover:bg-white/22"}`}
              >
                CAM {s.channel}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 rounded-pill bg-white/12 p-1 backdrop-blur">
            <button type="button" aria-label="Zoom out" onClick={() => zoomBy(0.8)} disabled={zoom.scale <= MIN_ZOOM} className="grid size-8 place-items-center rounded-full hover:bg-white/15 disabled:opacity-40">
              <Icon name="zoom_out" size={19} />
            </button>
            <button type="button" aria-label="Reset zoom" onClick={resetZoom} className="min-w-[52px] rounded-full px-2 py-1 font-mono text-[12px] hover:bg-white/15">
              {Math.round(zoom.scale * 100)}%
            </button>
            <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.25)} disabled={zoom.scale >= MAX_ZOOM} className="grid size-8 place-items-center rounded-full hover:bg-white/15 disabled:opacity-40">
              <Icon name="zoom_in" size={19} />
            </button>
          </div>

          {canCapture ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void capture.screenshot()}
                disabled={capture.busy}
                className="inline-flex items-center gap-1.5 rounded-pill bg-white/12 px-3.5 py-2 text-[12.5px] font-semibold backdrop-blur hover:bg-white/22 disabled:opacity-50"
              >
                <Icon name="photo_camera" size={17} />
                Screenshot
              </button>
              {capture.recording ? (
                <button type="button" onClick={capture.stop} className="inline-flex items-center gap-1.5 rounded-pill bg-critical px-3.5 py-2 text-[12.5px] font-semibold hover:opacity-90">
                  <Icon name="stop_circle" size={17} />
                  Stop · <Mono>{clock(capture.seconds)}</Mono>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void capture.record()}
                  disabled={capture.busy}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-white px-3.5 py-2 text-[12.5px] font-semibold text-black hover:bg-white/90 disabled:opacity-50"
                >
                  <span className="size-2.5 rounded-full bg-critical" />
                  Record
                </button>
              )}
            </div>
          ) : (
            <span />
          )}
          {capture.error ? <div className="w-full text-center text-[12px] text-[#f6aea9]">{capture.error}</div> : null}
        </div>
      </div>
    </div>
  );
}
