"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LiveMap } from "@/components/transport/live-map";
import {
  BackLink,
  Card,
  Icon,
  IconButton,
  Mono,
  StatusPill,
} from "@/components/transport/ui";
import { studentRows } from "@/lib/transport/derive";
import { BUS_TELEMETRY, REQUIRED_DOCS } from "@/lib/transport/seed";
import { useStore } from "@/lib/transport/store";
import { pill } from "@/lib/transport/tone";

const TABS = [
  "Overview",
  "Live Trip",
  "Students",
  "CCTV",
  "History",
  "Documents",
  "Maintenance",
] as const;
type Tab = (typeof TABS)[number];

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BusProfilePage() {
  const { busId } = useParams<{ busId: string }>();
  const { data, busDocs, dispatch } = useStore();
  const [tab, setTab] = useState<Tab>("Overview");

  // Keep the live map and the overview rail on the bus being viewed.
  useEffect(() => {
    if (BUS_TELEMETRY[busId]) dispatch({ type: "selectBus", id: busId });
  }, [busId, dispatch]);

  const telemetry = BUS_TELEMETRY[busId];
  const record = data.buses.find((b) => b.id === busId);
  if (!telemetry && !record) notFound();

  const bus = telemetry ?? {
    id: record!.id,
    reg: record!.reg,
    route: record!.route,
    status: record!.status,
    kind: record!.kind,
    driver: record!.driver,
    attendant: record!.attendant,
    students: record!.onboard,
    cap: Number(record!.cap) || 0,
    gps: record!.kind === "offline" ? "Offline" : "Strong",
    cam: "3 / 3 live",
  };

  const roster = studentRows(data).filter((s) => s.bus === `Bus ${busId}`);
  const docsForBus = busDocs[busId] ?? {};
  const onFile = REQUIRED_DOCS.filter((d) => docsForBus[d.key]).length;
  const pending = REQUIRED_DOCS.length - onFile;

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w.charAt(0))
      .join("");

  return (
    <div className="flex flex-col gap-[18px]">
      <BackLink href="/buses">All buses</BackLink>

      <Card className="px-[22px] pb-0 pt-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-[13px] bg-primary-tint text-primary">
            <Icon name="directions_bus" size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Bus {bus.id}</h2>
              <StatusPill pill={pill(bus.status, bus.kind)} />
            </div>
            <Mono className="mt-[3px] block text-[12.5px] text-faint">
              {bus.reg} · {bus.route}
            </Mono>
          </div>
          <div className="flex gap-2">
            <Link
              href="/cctv"
              className="rounded-[9px] border border-line px-3.5 py-[9px] text-[12.5px] font-semibold text-ink-2 hover:bg-canvas"
            >
              Live CCTV
            </Link>
            <Link
              href="/live"
              className="rounded-[9px] bg-primary px-3.5 py-[9px] text-[12.5px] font-semibold text-white hover:bg-primary-hover"
            >
              Track live
            </Link>
          </div>
        </div>

        <div className="mt-5 flex gap-[22px] overflow-x-auto border-b border-line-soft px-0.5">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="shrink-0 whitespace-nowrap pb-[11px] text-[13px]"
              style={{
                borderBottom: `2px solid ${tab === t ? "#16181b" : "transparent"}`,
                color: tab === t ? "#16181b" : "#5f6672",
                fontWeight: tab === t ? 600 : 500,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </Card>

      {tab === "Overview" ? (
        <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-[18px]">
            <Card className="px-5 py-[18px]">
              <div className="mb-3.5 text-[13.5px] font-semibold">Vehicle</div>
              <div className="grid grid-cols-2 gap-x-3.5 gap-y-4 sm:grid-cols-3">
                <Fact label="REGISTRATION" value={bus.reg} mono />
                <Fact label="CAPACITY" value={`${bus.cap} seats`} />
                <Fact label="MODEL" value="Ashok Leyland Sunshine" />
                <Fact label="FITNESS VALID" value="14 Mar 2027" />
                <Fact label="INSURANCE" value="02 Jan 2027" />
                <Fact label="LAST SERVICE" value="21 Aug 2026" />
              </div>
            </Card>

            <Card className="px-5 py-[18px]">
              <div className="mb-3.5 text-[13.5px] font-semibold">Crew and route</div>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <CrewCard role="DRIVER" name={bus.driver} initials={initials(bus.driver)} />
                <CrewCard role="ATTENDANT" name={bus.attendant} initials={initials(bus.attendant)} />
              </div>
              <Link
                href="/routes"
                className="mt-3.5 flex items-center justify-between rounded-xl bg-canvas px-3.5 py-[13px]"
              >
                <span>
                  <span className="block text-[10.5px] text-faint">ASSIGNED ROUTE</span>
                  <span className="block text-[13.5px] font-semibold text-ink">{bus.route}</span>
                </span>
                <Icon name="chevron_right" size={19} className="text-muted" />
              </Link>
            </Card>
          </div>

          <div className="flex flex-col gap-[18px]">
            <Card className="px-5 py-[18px]">
              <div className="mb-3.5 text-[13.5px] font-semibold">Vehicle health</div>
              <div className="flex flex-col gap-[11px]">
                <HealthRow label="GPS tracker" value={bus.gps} />
                <div className="h-px bg-line-rule" />
                <HealthRow label="Cameras" value={bus.cam} />
                <div className="h-px bg-line-rule" />
                <HealthRow label="Speed governor" value="Active · 50 km/h" />
                <div className="h-px bg-line-rule" />
                <HealthRow label="Emergency button" value="Tested 2 Sep" />
              </div>
            </Card>

            <Card className="px-5 py-[18px]">
              <div className="mb-3 text-[13.5px] font-semibold">Last 30 days</div>
              <div className="grid grid-cols-2 gap-3.5">
                <Metric value="58" label="trips completed" />
                <Metric value="96%" label="on-time rate" />
                <Metric value="3" label="speed events" />
                <Metric value="1" label="harsh braking" />
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "Live Trip" ? (
        <div className="relative h-[520px] overflow-hidden rounded-card border border-line bg-[#e8eaed]">
          <LiveMap selected={bus.id} focus={bus.id} />
        </div>
      ) : null}

      {tab === "Students" ? (
        <Card className="overflow-hidden">
          {roster.length ? (
            roster.map((s) => (
              <Link
                key={s.id}
                href={`/students/${s.id}`}
                className="grid min-w-[540px] grid-cols-[34px_minmax(150px,1fr)_190px_116px] items-center gap-3.5 border-b border-line-rule px-[18px] py-3 hover:bg-[#fafbfc]"
              >
                <span className="grid size-[34px] place-items-center rounded-full bg-neutral-tint text-[13px] font-semibold text-muted">
                  {s.initial}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink">{s.name}</span>
                  <span className="block text-[11.5px] text-faint">{s.cls}</span>
                </span>
                <span className="truncate text-xs text-muted">{s.stop}</span>
                <StatusPill pill={s.amPill} className="justify-self-start" />
              </Link>
            ))
          ) : (
            <div className="px-6 py-14 text-center">
              <div className="text-[13.5px] font-semibold">No students assigned</div>
              <div className="mt-1 text-[12.5px] text-faint">
                Assign students to this bus from the Students master.
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {tab === "Documents" ? (
        <div className="flex flex-col gap-4">
          <Card className="px-5 py-[18px]">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold">Statutory documents</div>
                <div className="mt-0.5 text-xs text-faint">
                  {onFile} of {REQUIRED_DOCS.length} on file · {pending} pending upload
                </div>
              </div>
              <div className="w-[180px]">
                <div className="h-1.5 overflow-hidden rounded-pill bg-line-soft">
                  <div
                    className="h-full rounded-pill bg-success"
                    style={{ width: `${Math.round((onFile / REQUIRED_DOCS.length) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            {pending === 0 ? (
              <div className="mt-3.5 flex items-center gap-2.5 rounded-control bg-success-tint px-3.5 py-[11px]">
                <Icon name="verified" size={18} className="text-success-text" />
                <span className="text-[12.5px] font-medium text-success-text">
                  All required documents are on file for this vehicle.
                </span>
              </div>
            ) : null}
          </Card>

          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
            {REQUIRED_DOCS.map((spec) => {
              const doc = docsForBus[spec.key];
              return (
                <div
                  key={spec.key}
                  className="rounded-[14px] border px-[18px] py-4"
                  style={{
                    borderColor: doc ? "#e4e7eb" : "#f0c99a",
                    background: doc ? "#fff" : "#fffdf7",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="grid size-[34px] shrink-0 place-items-center rounded-control"
                      style={{
                        background: doc ? "#e6f4ea" : "#f1f3f4",
                        color: doc ? "#186c33" : "#8b919b",
                      }}
                    >
                      <Icon name={doc ? "description" : "upload_file"} size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold tracking-[-0.005em]">
                        {spec.label}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-faint">{spec.note}</div>
                    </div>
                    <span
                      className="shrink-0 rounded-pill px-2 py-[3px] text-[10.5px] font-semibold"
                      style={{
                        background: doc ? "#e6f4ea" : "#fef7e0",
                        color: doc ? "#186c33" : "#8f5b00",
                      }}
                    >
                      {doc ? "On file" : "Pending"}
                    </span>
                  </div>

                  {doc ? (
                    <div className="mt-[13px] flex items-center gap-2.5 border-t border-line-rule pt-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">{doc.file}</div>
                        <div className="text-[11px] text-faint">
                          {doc.size} · uploaded {doc.on}
                          {doc.exp && doc.exp !== "—" ? ` · valid to ${doc.exp}` : ""}
                        </div>
                      </div>
                      <IconButton name="download" title={`Download ${spec.label}`} />
                      <IconButton
                        name="delete"
                        title={`Remove ${spec.label}`}
                        tone="danger"
                        onClick={() =>
                          dispatch({ type: "removeBusDoc", busId, key: spec.key })
                        }
                      />
                    </div>
                  ) : null}

                  <label className="mt-3 flex cursor-pointer items-center justify-center gap-[7px] rounded-control border border-dashed border-[#cfd4da] bg-surface p-[11px] hover:border-primary hover:bg-[#f7faff]">
                    <Icon name="upload" size={17} className="text-muted" />
                    <span className="text-xs font-semibold text-ink-2">Upload</span>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        dispatch({
                          type: "setBusDoc",
                          busId,
                          key: spec.key,
                          file: f.name,
                          size: fileSize(f.size),
                        });
                      }}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {tab === "CCTV" || tab === "History" || tab === "Maintenance" ? (
        <Card className="px-6 py-14 text-center">
          <span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-neutral-tint text-faint">
            <Icon name="folder_open" size={24} />
          </span>
          <div className="text-sm font-semibold">
            {tab} for Bus {bus.id}
          </div>
          <div className="mt-1 text-[12.5px] text-faint">
            Records appear here once the trip archive syncs for this vehicle.
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] text-faint">{label}</div>
      <div className={`text-[13px] font-medium ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function CrewCard({ role, name, initials }: { role: string; name: string; initials: string }) {
  return (
    <div className="flex items-center gap-[11px] rounded-xl border border-line-soft p-3">
      <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-neutral-tint text-[13px] font-semibold text-muted">
        {initials}
      </span>
      <span>
        <span className="block text-[10.5px] text-faint">{role}</span>
        <span className="block text-[13px] font-semibold text-ink">{name}</span>
      </span>
    </div>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="text-xs font-semibold text-success">{value}</span>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <Mono className="block text-2xl font-medium tracking-[-0.02em]">{value}</Mono>
      <div className="text-[11.5px] text-faint">{label}</div>
    </div>
  );
}
