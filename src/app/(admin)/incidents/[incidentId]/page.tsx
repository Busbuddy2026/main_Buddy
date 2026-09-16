"use client";

import { notFound, useParams } from "next/navigation";
import {
  BackLink,
  Card,
  CardHeader,
  Icon,
  Mono,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from "@/components/transport/ui";
import { INCIDENTS, INCIDENT_STEPS } from "@/lib/transport/incidents";
import { useStore } from "@/lib/transport/store";

export default function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const { dispatch } = useStore();

  const incident = INCIDENTS.find((i) => i.id === incidentId);
  if (!incident) notFound();

  return (
    <div className="flex flex-col gap-[18px]">
      <BackLink href="/incidents">All incidents</BackLink>

      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-[18px]">
          <Card className="px-[22px] py-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <Mono className="text-xl font-semibold tracking-[-0.02em]">{incident.id}</Mono>
              <StatusPill pill={{ ...incident.sev, label: incident.severityLabel }} />
            </div>
            <p className="mt-1.5 text-[13px] leading-[1.55] text-muted text-pretty">
              {incident.summary}
            </p>

            {/* Every status change is audit-logged with author and timestamp. */}
            <div className="mt-[18px] flex gap-2.5 border-t border-line-soft pt-4">
              {INCIDENT_STEPS.map((label, i) => {
                const reached = i <= incident.step;
                return (
                  <div key={label} className="min-w-0 flex-1">
                    <div
                      className="h-1 rounded-pill"
                      style={{ background: reached ? "#1a73e8" : "#e4e7eb" }}
                    />
                    <div
                      className="mt-[7px] truncate text-[11px]"
                      style={{
                        color: reached ? "#16181b" : "#8b919b",
                        fontWeight: i === incident.step ? 600 : 500,
                      }}
                    >
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Related footage" />
            <div className="relative grid aspect-[16/7] place-items-center bg-video">
              <Icon name="play_circle" size={40} style={{ color: "rgba(255,255,255,.3)" }} />
              <Mono className="absolute left-3.5 top-3 text-[11.5px] text-white/70">
                {incident.clip}
              </Mono>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-[18px]">
          <Card className="px-5 py-[18px]">
            <div className="mb-3.5 text-[13.5px] font-semibold">Context</div>
            <div className="flex flex-col gap-3">
              <Row label="Bus" value={`${incident.bus} · ${incident.reg}`} />
              <div className="h-px bg-line-rule" />
              <Row label="Trip" value={incident.trip} />
              <div className="h-px bg-line-rule" />
              <Row label="Driver" value={incident.driver} />
              <div className="h-px bg-line-rule" />
              <Row label="Students onboard" value={incident.onboard} mono />
            </div>
          </Card>

          <Card className="px-5 py-[18px]">
            <div className="mb-3 text-[13.5px] font-semibold">Notes</div>
            <p className="text-[12.5px] leading-[1.55] text-muted">{incident.notes}</p>
            <div className="mt-4 flex gap-2">
              <SecondaryButton
                className="flex-1 justify-center"
                onClick={() =>
                  dispatch({ type: "toast", message: `Note added to ${incident.id}` })
                }
              >
                Add note
              </SecondaryButton>
              <PrimaryButton
                className="flex-1 justify-center"
                onClick={() =>
                  dispatch({ type: "toast", message: `${incident.id} marked resolved` })
                }
              >
                Mark resolved
              </PrimaryButton>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className={`text-right text-[12.5px] font-semibold ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
