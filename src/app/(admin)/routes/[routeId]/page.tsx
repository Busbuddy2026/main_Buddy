"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { LiveMap } from "@/components/transport/live-map";
import {
  BackLink,
  Card,
  IconButton,
  Mono,
  PrimaryButton,
  SecondaryButton,
} from "@/components/transport/ui";
import { useData, useOpenCreate, useRowActions, useStore } from "@/lib/transport/store";
import { pad } from "@/lib/transport/tone";

export default function RouteDetailPage() {
  const { routeId } = useParams<{ routeId: string }>();
  const data = useData();
  const { dispatch } = useStore();
  const rowActions = useRowActions();
  const openCreate = useOpenCreate();

  const route = data.routes.find((r) => r.id === routeId);
  if (!route) notFound();

  const stops = data.stops.filter((s) => s.route === route.name);
  const routeActions = rowActions("Route", route.name, route.id);

  return (
    <div className="flex flex-col gap-[18px]">
      <BackLink href="/routes">All routes</BackLink>

      <Card className="px-[22px] py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{route.name}</h2>
            <Mono className="mt-[3px] block text-[12.5px] text-faint">
              {route.id} · {route.zone}
            </Mono>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/students"
              className="rounded-[9px] border border-line px-3.5 py-[9px] text-[12.5px] font-semibold text-ink-2 hover:bg-canvas"
            >
              Assign students
            </Link>
            <SecondaryButton onClick={routeActions.onEdit}>Edit route</SecondaryButton>
            <PrimaryButton
              icon="add"
              onClick={openCreate("Stop", `New stop on ${route.name}`, { route: route.name })}
            >
              Add stop
            </PrimaryButton>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3.5 border-t border-line-soft pt-[18px] sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="BUS ASSIGNED" value={route.bus} />
          <Stat label="TOTAL STOPS" value={pad(stops.length)} mono />
          <Stat label="STUDENTS" value={route.students} mono />
          <Stat label="DISTANCE" value={route.km} mono />
          <Stat label="DURATION" value={route.dur} mono />
        </div>
      </Card>

      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="px-[22px] py-5">
          <div className="mb-4 text-[13.5px] font-semibold">Stop sequence</div>
          {stops.length ? (
            stops.map((s, i) => {
              const actions = rowActions("Stop", s.name, s.id);
              const last = i === stops.length - 1;
              return (
                <div key={s.id} className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-start gap-3.5">
                  <div className="flex flex-col items-center">
                    <Mono className="grid size-7 place-items-center rounded-full border-[1.5px] border-line bg-surface text-[11px] font-semibold text-muted">
                      {pad(i + 1)}
                    </Mono>
                    {!last ? <div className="h-[34px] w-[1.5px] bg-line" /> : null}
                  </div>
                  <div className="pt-[5px]">
                    <div className="text-[13.5px] font-medium text-ink">{s.name}</div>
                    <div className="mt-0.5 text-[11.5px] text-faint">{s.students}</div>
                  </div>
                  <div className="flex items-center gap-2 pt-[3px]">
                    <Mono className="text-[12.5px] text-ink-2">{s.time}</Mono>
                    <IconButton
                      name="arrow_upward"
                      title={`Move ${s.name} earlier`}
                      onClick={() => dispatch({ type: "moveStop", id: s.id, dir: -1 })}
                    />
                    <IconButton
                      name="arrow_downward"
                      title={`Move ${s.name} later`}
                      onClick={() => dispatch({ type: "moveStop", id: s.id, dir: 1 })}
                    />
                    <IconButton name="edit" title={`Edit ${s.name}`} onClick={actions.onEdit} />
                    <IconButton
                      name="delete"
                      title={`Delete ${s.name}`}
                      tone="danger"
                      onClick={actions.onDelete}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
              <div className="text-[13px] font-semibold">No stops on this route yet</div>
              <div className="mt-1 text-[12.5px] text-faint">
                Add stops from the master or create a new one.
              </div>
            </div>
          )}
        </Card>

        <div className="relative min-h-[420px] overflow-hidden rounded-card border border-line bg-[#e8eaed]">
          <LiveMap focus="12" selected="12" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] text-faint">{label}</div>
      <div className={`text-sm font-semibold ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
