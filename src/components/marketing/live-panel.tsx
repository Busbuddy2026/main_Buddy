"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/marketing/motion";
import { NOTIFICATIONS, ROUTE, ROUTE_PATH } from "@/lib/marketing/content";

/**
 * The live route panel docked under the hero.
 *
 * The bus and the progress bar are driven straight through refs on every
 * frame; React state only syncs the three readouts, and only ~2×/second, so a
 * 60fps animation does not cost 60 renders.
 */

const SEGMENTS = ROUTE.length - 1;
/** Segments per second — about 4.5s per leg. */
const SPEED = 0.22;
const SYNC_MS = 420;
const FEED_MS = 2300;

function readout(seg: number, t: number) {
  return {
    nextStop: ROUTE[Math.min(seg + 1, ROUTE.length - 1)].name,
    eta: `${Math.max(1, Math.round((SEGMENTS - seg - t) * 4.5))} min`,
    boarded: `${12 + seg * 4} / 38`,
  };
}

export function LiveRoutePanel() {
  const busRef = useRef<SVGGElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const [{ seg, t }, setProgress] = useState({ seg: 0, t: 0 });
  const [feed, setFeed] = useState(1);
  // Still: the whole feed, and the bus parked at the depot.
  const shownFeed = reduced ? NOTIFICATIONS.length : feed;

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(
      () => setFeed((n) => (n >= NOTIFICATIONS.length ? 1 : n + 1)),
      FEED_MS,
    );
    return () => window.clearInterval(id);
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;

    let raf = 0;
    let segment = 0;
    let f = 0;
    let last = performance.now();
    let lastSync = 0;

    const loop = (now: number) => {
      // Clamped so a backgrounded tab does not resume with one giant jump.
      const dt = Math.min(64, now - last);
      last = now;
      f += (dt / 1000) * SPEED;
      if (f >= 1) {
        f = 0;
        segment = (segment + 1) % SEGMENTS;
      }

      const a = ROUTE[segment];
      const b = ROUTE[segment + 1];
      busRef.current?.setAttribute(
        "transform",
        `translate(${(a.x + (b.x - a.x) * f).toFixed(1)},${(a.y + (b.y - a.y) * f).toFixed(1)})`,
      );
      if (barRef.current) {
        barRef.current.style.width = `${(8 + ((segment + f) / SEGMENTS) * 92).toFixed(1)}%`;
      }

      if (now - lastSync > SYNC_MS) {
        lastSync = now;
        setProgress({ seg: segment, t: f });
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const { nextStop, eta, boarded } = readout(seg, t);
  const items = NOTIFICATIONS.slice(0, shownFeed).reverse();

  return (
    <div className="relative mx-auto w-full max-w-[1180px] px-[26px]">
      <div
        data-reveal
        className="overflow-hidden rounded-t-[20px] border border-bb-line-3 bg-bb-raised shadow-[0_-10px_120px_-30px_rgba(255,255,255,.18)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3.5 border-b border-[#1a1d20] px-[18px] py-[13px] font-code text-[10px] uppercase tracking-[0.14em] text-bb-muted-3">
          <span className="flex items-center gap-2">
            <span className="size-[5px] rounded-full bg-bb-text [animation:bb-blink_1.4s_infinite]" />
            Live · Route 12 · Morning trip
          </span>
          <span>Bus TN-91-SP-3777 · 38 students</span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))]">
          <div className="border-b border-[#1a1d20] lg:border-b-0 lg:border-r">
            <RouteMap busRef={busRef} />
          </div>

          <div className="flex flex-col gap-[18px] px-6 py-[22px]">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(96px,100%),1fr))] gap-4">
              <Readout label="Next stop" value={nextStop} />
              <Readout label="ETA" value={eta} />
              <Readout label="Boarded" value={boarded} />
            </div>

            <div>
              <div className="h-1 overflow-hidden rounded bg-bb-line-2">
                <div ref={barRef} className="h-full w-[8%] bg-bb-text" />
              </div>
              <div className="mt-2 flex justify-between font-code text-[9.5px] uppercase tracking-[0.1em] text-bb-muted-4">
                <span>Depot</span>
                <span>School</span>
              </div>
            </div>

            <ul className="flex flex-col gap-px overflow-hidden rounded-xl border border-[#1a1d20] bg-[#1a1d20]">
              {items.map((n, i) => (
                <li
                  key={n.time}
                  className={`flex items-start gap-3 px-3.5 py-3 ${
                    i === 0 ? "bg-bb-raised-2" : "bg-bb-surface"
                  }`}
                >
                  <span className="mt-0.5 min-w-9 font-code text-[10px] text-bb-muted-4">
                    {n.time}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold leading-[1.35]">{n.title}</div>
                    <div className="mt-0.5 text-[11.5px] text-bb-muted-3">{n.meta}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-code text-[9.5px] uppercase tracking-[0.14em] text-bb-muted-4">
        {label}
      </div>
      {/* aria-live keeps a screen reader in step with the trip, quietly. */}
      <div className="mt-1.5 text-[15px] font-semibold" aria-live="polite">
        {value}
      </div>
    </div>
  );
}

function RouteMap({ busRef }: { busRef: React.RefObject<SVGGElement | null> }) {
  return (
    <svg
      viewBox="0 0 640 400"
      role="img"
      aria-label="Route 12, morning trip: a bus driving from the depot to the school past five stops."
      className="block h-auto w-full bg-[#0a0c0d]"
    >
      <defs>
        <pattern id="bbRouteGrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#131618" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="640" height="400" fill="url(#bbRouteGrid)" />

      <path d="M0 108H640" stroke="#16191b" strokeWidth="7" />
      <path d="M452 0V400" stroke="#16191b" strokeWidth="7" />
      <path d="M0 292H640" stroke="#141719" strokeWidth="5" />

      <rect x="60" y="146" width="118" height="82" fill="#0e1113" stroke="#181b1e" />
      <rect x="212" y="38" width="94" height="56" fill="#0e1113" stroke="#181b1e" />
      <rect x="512" y="242" width="100" height="116" fill="#0e1113" stroke="#181b1e" />

      <path
        d={`M${ROUTE_PATH}`}
        fill="none"
        stroke="#1f2326"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M${ROUTE_PATH}`}
        fill="none"
        stroke="#f2f3f4"
        strokeWidth="2"
        strokeDasharray="9 13"
        strokeLinecap="round"
        className="[animation:bb-dash_6s_linear_infinite]"
      />

      <g fill="#0a0c0d" stroke="#5f666b" strokeWidth="2">
        {ROUTE.slice(0, -1).map((s) => (
          <circle key={s.name} cx={s.x} cy={s.y} r="5.5" />
        ))}
      </g>

      <g transform="translate(580,94)">
        <circle r="11" fill="#f2f3f4" />
        <path d="M-4.5 2 L0 -4.5 L4.5 2 Z" fill="#08090a" />
      </g>
      <text
        x="562"
        y="72"
        textAnchor="end"
        fontFamily="JetBrains Mono, monospace"
        fontSize="10.5"
        fill="#9aa0a5"
        letterSpacing="1"
      >
        SCHOOL
      </text>

      <g ref={busRef} transform="translate(56,336)">
        <circle r="20" fill="#f2f3f4" opacity=".16" className="[animation:bb-pulse_2.1s_infinite]" />
        <g transform="translate(-14,-10)">
          <rect width="28" height="20" rx="6" fill="#f2f3f4" />
          <rect x="4" y="4" width="8" height="6" rx="2" fill="#0a0c0d" />
          <rect x="16" y="4" width="8" height="6" rx="2" fill="#0a0c0d" />
        </g>
      </g>
    </svg>
  );
}
