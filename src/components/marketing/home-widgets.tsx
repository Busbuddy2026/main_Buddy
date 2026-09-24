"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/marketing/motion";
import { FACE_STEPS, FAQS, PLATFORM_TABS, STATS, type Stat } from "@/lib/marketing/content";

/* ── Platform tabs ─────────────────────────────────────────────────────── */

export function PlatformTabs() {
  const [active, setActive] = useState(0);
  const tab = PLATFORM_TABS[active];

  const onKeyDown = (e: React.KeyboardEvent) => {
    const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1
      : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1
      : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (active + delta + PLATFORM_TABS.length) % PLATFORM_TABS.length;
    setActive(next);
    document.getElementById(`bb-tab-${next}`)?.focus();
  };

  return (
    <div className="mt-11 grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] items-start gap-[26px]">
      <div
        role="tablist"
        aria-label="How the platform works"
        aria-orientation="vertical"
        onKeyDown={onKeyDown}
        className="flex flex-col gap-px overflow-hidden rounded-2xl border border-bb-line bg-bb-line"
      >
        {PLATFORM_TABS.map((t, i) => {
          const on = i === active;
          return (
            <button
              key={t.name}
              id={`bb-tab-${i}`}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls="bb-tabpanel"
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              className={`flex items-start gap-4 p-[22px] text-left ${
                on ? "bg-bb-active" : "bg-bb-surface"
              }`}
            >
              <span
                className={`mt-1 font-code text-[10px] tracking-[0.1em] ${
                  on ? "text-bb-text" : "text-bb-faint"
                }`}
              >
                {`0${i + 1}`}
              </span>
              <span className="flex-1">
                <span
                  className={`block text-[16.5px] font-semibold tracking-[-0.02em] ${
                    on ? "text-bb-text" : "text-bb-text-2"
                  }`}
                >
                  {t.name}
                </span>
                <span
                  className={`mt-[7px] block text-[13px] font-light leading-[1.6] ${
                    on ? "text-bb-muted" : "text-bb-muted-4"
                  }`}
                >
                  {t.blurb}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        id="bb-tabpanel"
        role="tabpanel"
        aria-labelledby={`bb-tab-${active}`}
        tabIndex={0}
        className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-bb-line-3 bg-bb-raised"
      >
        <div className="flex items-center justify-between border-b border-[#1a1d20] px-[17px] py-[13px] font-code text-[9.5px] uppercase tracking-[0.14em] text-bb-muted-3">
          <span>{tab.label}</span>
          <span>{`0${active + 1}`} of 04</span>
        </div>
        <div className="flex flex-1 flex-col gap-[18px] p-[26px]">
          <ul className="flex flex-col gap-px overflow-hidden rounded-xl border border-[#1a1d20] bg-[#1a1d20]">
            {tab.rows.map(([k, v]) => (
              <li key={k} className="flex items-center gap-3.5 bg-bb-surface px-4 py-[15px]">
                <span className="size-1.5 shrink-0 rounded-full bg-bb-text" />
                <span className="flex-1 text-[13.5px] text-bb-text-2">{k}</span>
                <span className="font-code text-[11px] text-bb-muted-3">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ── Safety+ door sequence ─────────────────────────────────────────────── */

export function FaceSequence() {
  const reduced = usePrefersReducedMotion();
  // One past the last step, so the sequence rests on "all done" before looping.
  const [step, setStep] = useState(0);
  const shown = reduced ? FACE_STEPS.length : step;

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % (FACE_STEPS.length + 1)), 1700);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <ol className="mt-7 flex max-w-[560px] flex-col gap-px overflow-hidden rounded-[14px] border border-bb-line bg-bb-line">
      {FACE_STEPS.map((label, i) => {
        const done = i < shown;
        const active = i === shown;
        return (
          <li
            key={label}
            className={`flex items-center gap-3.5 px-[18px] py-[15px] ${
              active ? "bg-bb-text" : "bg-bb-surface"
            }`}
          >
            <span
              className={`min-w-[22px] font-code text-[10.5px] ${
                active ? "text-bb-eyebrow" : "text-bb-faint"
              }`}
            >
              {`0${i + 1}`}
            </span>
            <span
              className={`flex-1 text-[14px] font-medium ${
                active ? "text-bb-bg" : done ? "text-bb-text" : "text-bb-eyebrow"
              }`}
            >
              {label}
            </span>
            <span
              className={`font-code text-[10px] uppercase tracking-[0.12em] ${
                active ? "text-bb-eyebrow" : "text-bb-faint"
              }`}
            >
              {active ? "running" : done ? "done" : "waiting"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function FaceScanFrame() {
  return (
    <div
      data-reveal
      aria-hidden
      className="relative h-[300px] w-[250px] justify-self-center overflow-hidden rounded-2xl border border-bb-line-3 bg-bb-raised-2"
    >
      <div className="absolute inset-0 grid place-items-center">
        <svg viewBox="0 0 24 24" width="74" height="74" fill="none" stroke="#2f3438" strokeWidth="1">
          <circle cx="12" cy="9" r="4" />
          <path d="M4.5 20.5c0-4 3.4-6.2 7.5-6.2s7.5 2.2 7.5 6.2" />
        </svg>
      </div>
      <div className="absolute inset-x-[34px] bottom-11 top-11 rounded-[10px] border border-[rgba(242,243,244,.22)]" />
      <div className="absolute inset-x-[34px] h-[1.5px] bg-bb-text shadow-[0_0_20px_5px_rgba(242,243,244,.45)] [animation:bb-scan_2.2s_ease-in-out_infinite_alternate]" />
      <div className="absolute bottom-3 left-4 flex items-center gap-[7px] font-code text-[9px] uppercase tracking-[0.16em] text-bb-muted-4">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#6b7176" strokeWidth="1.6">
          <path d="M3.5 7.5h11v9h-11z" />
          <path d="M14.5 11l6-3v8l-6-3z" />
        </svg>
        Cam · door
      </div>
    </div>
  );
}

/* ── Stat counters ─────────────────────────────────────────────────────── */

function format(value: number, kind: Stat["format"]) {
  switch (kind) {
    case "int":
      return Math.round(value).toLocaleString("en-IN");
    case "seconds":
      return `${Math.max(1, Math.round(value))}s`;
    case "percent1":
      return `${value.toFixed(1)}%`;
    case "percent0":
      return `${Math.round(value)}%`;
  }
}

export function StatCounters() {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [values, setValues] = useState(() => STATS.map(() => 0));
  // No count-up: the figures are simply already there.
  const shown = reduced ? STATS.map((s) => s.target) : values;

  useEffect(() => {
    const host = ref.current;
    if (!host || reduced) return;

    let raf = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 1400);
        const eased = 1 - Math.pow(1 - p, 3);
        setValues(STATS.map((s) => s.target * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        run();
      },
      { threshold: 0.2 },
    );
    io.observe(host);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <div
      ref={ref}
      data-reveal
      className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-px overflow-hidden rounded-[18px] border border-bb-line bg-bb-line"
    >
      {STATS.map((s, i) => (
        <div key={s.label} className="bg-bb-surface px-[26px] py-[30px]">
          <div className="font-code text-[32px] font-bold tracking-[-0.04em]">
            {format(shown[i], s.format)}
          </div>
          <div className="mt-2 text-[12.5px] text-bb-muted-3">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── FAQ ───────────────────────────────────────────────────────────────── */

export function FaqList() {
  const [open, setOpen] = useState(0);

  return (
    <div className="border-t border-[#1a1d20]">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className={`border-b border-[#1a1d20] ${isOpen ? "bg-bb-raised" : ""}`}>
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                aria-controls={`bb-faq-${i}`}
                className="flex w-full items-center gap-[18px] px-1.5 py-[22px] text-left text-bb-text hover:text-bb-muted"
              >
                <span className="min-w-[26px] font-code text-[10.5px] text-bb-eyebrow">
                  {`0${i + 1}`}
                </span>
                <span className="flex-1 text-[16px] font-medium tracking-[-0.01em]">{f.q}</span>
                <span
                  aria-hidden
                  className="min-w-4 text-center font-code text-[18px] text-bb-muted"
                >
                  {isOpen ? "–" : "+"}
                </span>
              </button>
            </h3>
            <div
              id={`bb-faq-${i}`}
              hidden={!isOpen}
              className="max-w-[740px] pb-6 pl-[50px] pr-1.5 text-[14.5px] font-light leading-[1.7] text-bb-muted-2"
            >
              {f.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}
