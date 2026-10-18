"use client";

import Link from "next/link";
import { BusCard } from "@/components/transport/bus-card";
import { LiveMap, toMapVehicles } from "@/components/transport/live-map";
import { Card, CardHeader, Icon, Mono, StatusPill } from "@/components/transport/ui";
import { useApi } from "@/lib/api/use-api";
import { usePoll } from "@/lib/api/use-poll";
import { useAdmin } from "@/lib/transport/admin-store";
import { greetingFor } from "@/lib/transport/parent";
import { useStore } from "@/lib/transport/store";
import { TONE, pill } from "@/lib/transport/tone";
import { liveLabel, useLiveFleet, useTrails } from "@/lib/transport/use-live";

interface Today {
  summary: { expected: number; boarded: number; absent: number; dropped: number; pending: number };
}
interface Incidents {
  items: Array<{ id: string; code: string; bus: string; type: string; status: { label: string } }>;
}

const n = (v: number | undefined) => (v === undefined ? "—" : v.toLocaleString("en-IN"));

/** A1 — the morning at a glance: live map, today's numbers, what needs attention. */
export default function OverviewPage() {
  const { user } = useAdmin();
  const { selectedBus, dispatch } = useStore();
  const live = useLiveFleet();
  const trails = useTrails();
  const today = useApi<Today>("/api/admin/attendance/today");
  const incidents = useApi<Incidents>("/api/admin/incidents");
  usePoll(today.reload, 30_000);
  usePoll(incidents.reload, 30_000);

  const buses = live.data?.buses ?? [];
  const bus = buses.find((b) => b.number === selectedBus) ?? buses.find((b) => b.fix) ?? buses[0];
  const onTrip = buses.filter((b) => b.trip);
  const delayed = buses.filter((b) => (b.trip?.delayMin ?? 0) > 5);
  const offline = buses.filter((b) => b.linked && b.state === "offline");
  const open = (incidents.data?.items ?? []).filter((i) => i.status.label === "New");
  const s = today.data?.summary;

  const KPIS = [
    { label: "Buses on trip", value: n(onTrip.length), foot: `of ${buses.length} in the fleet`, icon: "directions_bus", accent: "#1a73e8" },
    { label: "Students onboard", value: n(onTrip.reduce((t, b) => t + (b.trip?.onboard ?? 0), 0)), foot: `across ${onTrip.length} live trips`, icon: "group", accent: "#1a73e8" },
    { label: "Boarded today", value: n(s?.boarded), foot: s ? `${s.expected ? Math.round((s.boarded / s.expected) * 100) : 0}% of expected` : "", icon: "school", accent: "#1e8e3e" },
    { label: "Delayed buses", value: n(delayed.length), foot: delayed[0] ? `Bus ${delayed[0].number} · ${delayed[0].trip?.delayMin} min` : "None right now", icon: "schedule", accent: "#f29900" },
    { label: "New alerts", value: n(open.length), foot: open[0] ? `${open[0].code} · ${open[0].type}` : "Nothing new", icon: "warning", accent: "#d93025" },
  ];

  const alerts = [
    ...open.slice(0, 3).map((i) => ({
      icon: "warning", tone: TONE.bad, title: `${i.code} · ${i.type}`, body: `${i.bus}. Raised and waiting for review.`,
      action: "Open incident", href: `/admin/incidents/${i.id}`, bus: null as string | null,
    })),
    ...delayed.map((b) => ({
      icon: "schedule", tone: TONE.delayed, title: `Bus ${b.number} delayed ${b.trip?.delayMin} minutes`,
      body: `${b.trip?.onboard ?? 0} students onboard${b.trip?.nextStop ? ` · next ${b.trip.nextStop.name}` : ""}.`,
      action: "View on map", href: "/admin/live", bus: b.number,
    })),
    ...offline.map((b) => ({
      icon: "gps_off", tone: TONE.offline, title: `Bus ${b.number} GPS offline`,
      body: b.fix ? `Last fix ${b.fix.ageMin} min ago${b.fix.address ? ` near ${b.fix.address}` : ""}.` : "No position received yet.",
      action: "Open bus", href: `/admin/buses/${b.number}`, bus: b.number,
    })),
  ];

  return (
    <div className="flex flex-col gap-[22px]">
      <div>
        <h2 className="text-[26px] font-semibold tracking-[-0.025em]">
          {greetingFor(new Date())}, {user.firstName}
        </h2>
        <p className="mt-1 text-[13.5px] text-muted">
          {onTrip.length ? `${onTrip.length} bus${onTrip.length === 1 ? "" : "es"} on trip.` : "No trips running right now."}{" "}
          {alerts.length ? `${alerts.length} item${alerts.length === 1 ? " needs" : "s need"} attention.` : "Nothing needs attention."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        {KPIS.map((k) => (
          <Card key={k.label} className="px-[18px] py-4">
            <div className="flex items-center gap-[7px] text-xs font-medium text-muted">
              <Icon name={k.icon} size={16} style={{ color: k.accent }} />
              {k.label}
            </div>
            <Mono className="mt-2 block text-[30px] font-medium tracking-[-0.03em]">{k.value}</Mono>
            <div className="mt-[3px] truncate text-[11.5px] text-faint">{k.foot}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Live operations"
          action={
            <Link href="/admin/live" className="flex shrink-0 items-center gap-0.5 text-[12.5px] font-medium text-primary">
              Open Live Operations
              <Icon name="arrow_forward" size={16} />
            </Link>
          }
        />
        <div className="relative h-[400px]">
          <LiveMap
            trails={trails}
            vehicles={toMapVehicles(buses)}
            routes={live.data?.routes}
            selected={bus?.number}
            onSelect={(id) => dispatch({ type: "selectBus", id })}
          />
          {bus ? <BusCard bus={bus} /> : null}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-x-auto">
          <CardHeader
            title="Active trips"
            action={<Link href="/admin/live/trips" className="text-[12.5px] font-medium text-primary">See all</Link>}
          />
          {onTrip.length === 0 ? <div className="px-[18px] py-8 text-center text-[12.5px] text-faint">No trips running.</div> : null}
          {onTrip.map((t) => {
            const l = liveLabel(t);
            return (
              <Link
                key={t.busId}
                href={`/admin/buses/${t.number}`}
                onClick={() => dispatch({ type: "selectBus", id: t.number })}
                className="grid min-w-[560px] grid-cols-[64px_minmax(150px,1fr)_100px_120px_76px] items-center gap-3.5 border-b border-line-rule px-[18px] py-3.5 hover:bg-[#fafbfc]"
              >
                <Mono className="text-sm font-semibold text-ink">Bus {t.number}</Mono>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink">{t.route ?? "No route"}</div>
                  <div className="mt-[5px] text-[11px] text-faint">Next: {t.trip?.nextStop?.name ?? "—"}</div>
                </div>
                <Mono className="text-[12.5px] text-ink-2">{t.trip?.onboard ?? 0} / {t.capacity}</Mono>
                <StatusPill pill={pill(l.label, l.kind)} className="justify-self-start" />
                <Mono className="text-right text-[12.5px] text-muted">
                  {t.trip?.nextStop ? `${t.trip.nextStop.etaMin} min` : "—"}
                </Mono>
              </Link>
            );
          })}
        </Card>

        <Card>
          <CardHeader title="Attention required" />
          {alerts.length === 0 ? <div className="px-[18px] py-8 text-center text-[12.5px] text-faint">All clear.</div> : null}
          {alerts.map((a) => (
            <div key={a.title} className="flex gap-3 border-b border-line-rule px-[18px] py-3.5">
              <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px]" style={{ background: a.tone.bg, color: a.tone.fg }}>
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
        </Card>
      </div>
    </div>
  );
}
