"use client";

import Link from "next/link";
import { useState } from "react";
import { LiveMap } from "@/components/transport/live-map";
import {
  Card,
  CardHeader,
  Icon,
  Mono,
  StatusPill,
} from "@/components/transport/ui";
import { BUS_TELEMETRY, SCHOOL } from "@/lib/transport/seed";
import { useStore } from "@/lib/transport/store";
import { TONE, pill } from "@/lib/transport/tone";

const KPIS = [
  { label: "Active buses", value: "22", foot: "of 24 in service", size: 34, icon: "directions_bus", accent: "#1a73e8" },
  { label: "Students onboard", value: "113", foot: "across 3 live trips", size: 34, icon: "group", accent: "#1a73e8" },
  { label: "Reached school", value: "1,042", foot: "84% of expected", size: 26, icon: "school", accent: "#1e8e3e" },
  { label: "Delayed buses", value: "1", foot: "Bus 08 · 12 min", size: 26, icon: "schedule", accent: "#f29900" },
  { label: "Active alerts", value: "2", foot: "1 needs review", size: 26, icon: "warning", accent: "#d93025" },
];

const ALERTS = [
  {
    icon: "schedule",
    tone: TONE.delayed,
    title: "Bus 08 delayed 12 minutes",
    body: "Traffic on Gachibowli flyover. 31 students onboard. Parents notified automatically.",
    action: "View trip",
    href: "/live",
    bus: "08",
  },
  {
    icon: "gps_off",
    tone: TONE.bad,
    title: "Bus 04 GPS offline for 6 minutes",
    body: "Last known position Kondapur Main Road at 7:36 AM. Trip has not started.",
    action: "Open bus",
    href: "/buses/04",
    bus: "04",
  },
  {
    icon: "videocam_off",
    tone: TONE.offline,
    title: "Bus 08 door camera offline",
    body: "No stream since 6:58 AM. Recording unaffected on front and cabin cameras.",
    action: "Camera health",
    href: "/cctv/health",
    bus: null,
  },
];

export default function OverviewPage() {
  const { selectedBus, dispatch } = useStore();
  const [session, setSession] = useState<"Morning" | "Evening">("Morning");

  const bus = BUS_TELEMETRY[selectedBus] ?? BUS_TELEMETRY["12"];

  const trips = Object.values(BUS_TELEMETRY).filter((b) => b.kind !== "offline");

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-0.025em]">
            Good morning, {SCHOOL.firstName}
          </h2>
          <p className="mt-1 text-[13.5px] text-muted">
            Morning session is 62% complete. One bus needs attention.
          </p>
        </div>
        <div className="flex gap-1.5 rounded-control border border-line bg-surface p-1">
          {(["Morning", "Evening"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSession(s)}
              className="rounded-[7px] px-3.5 py-[7px] text-[12.5px] font-medium"
              style={
                session === s
                  ? { background: "#16181b", color: "#fff" }
                  : { color: "#5f6672" }
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-[1.25fr_1.25fr_1fr_1fr_1fr]">
        {KPIS.map((k) => (
          <Card key={k.label} className="px-[18px] py-4">
            <div className="flex items-center gap-[7px] text-xs font-medium text-muted">
              <Icon name={k.icon} size={16} style={{ color: k.accent }} />
              {k.label}
            </div>
            <Mono
              className="mt-2 block font-medium tracking-[-0.03em]"
              style={{ fontSize: k.size }}
            >
              {k.value}
            </Mono>
            <div className="mt-[3px] text-[11.5px] text-faint">{k.foot}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Live operations"
          action={
            <div className="flex items-center gap-3.5">
              <div className="hidden gap-3.5 text-[11.5px] text-muted sm:flex">
                {(
                  [
                    ["On time", "#1a73e8"],
                    ["Delayed", "#f29900"],
                    ["Offline", "#9aa0a6"],
                  ] as const
                ).map(([label, color]) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className="size-[7px] rounded-sm" style={{ background: color }} />
                    {label}
                  </span>
                ))}
              </div>
              <Link
                href="/live"
                className="flex shrink-0 items-center gap-0.5 text-[12.5px] font-medium text-primary"
              >
                Open Live Operations
                <Icon name="arrow_forward" size={16} />
              </Link>
            </div>
          }
        />
        <div className="relative h-[400px]">
          <LiveMap
            selected={selectedBus}
            onSelect={(id) => dispatch({ type: "selectBus", id })}
          />
          <div
            className="absolute right-4 top-4 z-[500] w-72 overflow-hidden rounded-card border border-line bg-surface"
            style={{ boxShadow: "var(--shadow-float)" }}
          >
            <div className="border-b border-line-soft px-4 pb-3 pt-3.5">
              <div className="flex items-center justify-between gap-2">
                <Mono className="text-[17px] font-semibold tracking-[-0.02em]">
                  Bus {bus.id}
                </Mono>
                <StatusPill pill={pill(bus.status, bus.kind)} />
              </div>
              <div className="mt-0.5 text-xs text-faint">{bus.route}</div>
            </div>
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-3 px-4 py-3">
              <MiniFact label="DRIVER" value={bus.driver} />
              <MiniFact label="ATTENDANT" value={bus.attendant} />
              <MiniFact label="ONBOARD" value={`${bus.students} / ${bus.cap}`} mono />
              <MiniFact label="SPEED" value={`${bus.speed} km/h`} mono />
            </div>
            <div className="px-4 pb-3">
              <div className="rounded-control bg-canvas px-3 py-[11px]">
                <div className="text-[10.5px] tracking-[0.02em] text-faint">NEXT STOP</div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2">
                  <div className="text-[13.5px] font-semibold">{bus.next}</div>
                  <Mono className="text-[12.5px] font-semibold text-primary">{bus.eta}</Mono>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              <Link
                href="/cctv"
                className="rounded-[9px] bg-primary py-[9px] text-center text-[12.5px] font-semibold text-white hover:bg-primary-hover"
              >
                Live CCTV
              </Link>
              <Link
                href={`/buses/${bus.id}`}
                className="rounded-[9px] border border-line py-[9px] text-center text-[12.5px] font-semibold text-ink-2 hover:bg-canvas"
              >
                Open trip
              </Link>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-x-auto">
          <CardHeader
            title="Active trips"
            action={
              <Link href="/live/trips" className="text-[12.5px] font-medium text-primary">
                See all
              </Link>
            }
          />
          {trips.map((t) => (
            <Link
              key={t.id}
              href={`/buses/${t.id}`}
              onClick={() => dispatch({ type: "selectBus", id: t.id })}
              className="grid min-w-[560px] grid-cols-[64px_minmax(150px,1fr)_100px_92px_76px] items-center gap-3.5 border-b border-line-rule px-[18px] py-3.5 hover:bg-[#fafbfc]"
            >
              <Mono className="text-sm font-semibold text-ink">Bus {t.id}</Mono>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-ink">{t.route}</div>
                <div className="mt-[7px] h-1 overflow-hidden rounded-pill bg-line-soft">
                  <div
                    className="h-full rounded-pill"
                    style={{
                      width: `${t.progress}%`,
                      background: t.kind === "delayed" ? "#f29900" : "#1a73e8",
                    }}
                  />
                </div>
                <div className="mt-[5px] text-[11px] text-faint">Next: {t.next}</div>
              </div>
              <Mono className="text-[12.5px] text-ink-2">
                {t.students} / {t.cap}
              </Mono>
              <StatusPill pill={pill(t.status, t.kind)} className="justify-self-start" />
              <Mono className="text-right text-[12.5px] text-muted">{t.eta}</Mono>
            </Link>
          ))}
        </Card>

        <Card>
          <CardHeader title="Attention required" />
          <div className="flex flex-col">
            {ALERTS.map((a) => (
              <div key={a.title} className="flex gap-3 border-b border-line-rule px-[18px] py-3.5">
                <span
                  className="grid size-[30px] shrink-0 place-items-center rounded-[9px]"
                  style={{ background: a.tone.bg, color: a.tone.fg }}
                >
                  <Icon name={a.icon} size={18} />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold tracking-[-0.005em]">{a.title}</div>
                  <p className="mt-[3px] text-xs leading-[1.45] text-muted text-pretty">{a.body}</p>
                  <Link
                    href={a.href}
                    onClick={() => a.bus && dispatch({ type: "selectBus", id: a.bus })}
                    className="mt-[7px] inline-block text-xs font-semibold text-primary"
                  >
                    {a.action}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MiniFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] tracking-[0.02em] text-faint">{label}</div>
      <div className={`text-[13px] font-medium ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
