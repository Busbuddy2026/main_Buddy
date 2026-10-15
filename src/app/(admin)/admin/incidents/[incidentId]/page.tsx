"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
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
import { TextInput } from "@/components/transport/form-controls";
import { api, errorMessage } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { useAdmin } from "@/lib/transport/admin-store";
import { useStore } from "@/lib/transport/store";
import { pill } from "@/lib/transport/tone";
import type { incidentDetail } from "@/server/services/safety";

type Incident = Awaited<ReturnType<typeof incidentDetail>>;

const STEPS = [
  { key: "NEW", label: "New" },
  { key: "UNDER_REVIEW", label: "Under Review" },
  { key: "INVESTIGATING", label: "Investigating" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "CLOSED", label: "Closed" },
] as const;

const EVENT_TEXT: Record<string, string> = {
  CREATED: "Incident logged",
  SOS_RAISED: "SOS raised from the bus",
  SOS_CANCELLED_BY_CREW: "SOS cancelled by the crew",
  NOTE: "Note",
  ASSIGNED: "Assigned",
  SEVERITY_CHANGED: "Severity changed",
};

export default function IncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const { dispatch } = useStore();
  const { canEdit } = useAdmin();
  const detail = useApi<Incident>(`/api/admin/incidents/${incidentId}`);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const incident = detail.data;

  const change = async (patch: Record<string, string>, done: string) => {
    if (!incident) return;
    setBusy(true);
    try {
      await api.patch(`/api/admin/incidents/${incident.id}`, patch);
      await detail.reload();
      dispatch({ type: "toast", message: done });
    } catch (error) {
      dispatch({ type: "toast", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  /** Clip playback arrives with the video gateway; the access is audited now. */
  const openClip = async (id: string) => {
    await api.post(`/api/admin/cctv/recordings/${id}/view`).catch(() => undefined);
    dispatch({ type: "toast", message: "Clip playback arrives with the video gateway. This view was logged." });
  };

  if (detail.error && !incident) {
    return (
      <div className="flex flex-col gap-[18px]">
        <BackLink href="/admin/incidents">All incidents</BackLink>
        <Card className="px-6 py-14 text-center text-[13px] text-muted">{detail.error}</Card>
      </div>
    );
  }
  if (!incident) {
    return (
      <div className="flex flex-col gap-[18px]">
        <BackLink href="/admin/incidents">All incidents</BackLink>
        <Card className="px-6 py-14 text-center text-[13px] text-faint">Loading…</Card>
      </div>
    );
  }

  const nextStep = STEPS[incident.step + 1];

  return (
    <div className="flex flex-col gap-[18px]">
      <BackLink href="/admin/incidents">All incidents</BackLink>

      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-[18px]">
          <Card className="px-[22px] py-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <Mono className="text-xl font-semibold tracking-[-0.02em]">{incident.code}</Mono>
              <StatusPill pill={pill(`${incident.severityView.label} priority`, incident.severityView.kind)} />
              <StatusPill pill={pill(incident.statusView.label, incident.statusView.kind)} />
            </div>
            <div className="mt-1 text-[13.5px] font-semibold">{incident.type}</div>
            <p className="mt-1.5 text-[13px] leading-[1.55] text-muted text-pretty">{incident.description}</p>

            {/* Every status change is audit-logged with author and timestamp. */}
            <div className="mt-[18px] flex gap-2.5 border-t border-line-soft pt-4">
              {STEPS.map((s, i) => {
                const reached = i <= incident.step;
                return (
                  <div key={s.key} className="min-w-0 flex-1">
                    <div className="h-1 rounded-pill" style={{ background: reached ? "#1a73e8" : "#e4e7eb" }} />
                    <div
                      className="mt-[7px] truncate text-[11px]"
                      style={{ color: reached ? "#16181b" : "#8b919b", fontWeight: i === incident.step ? 600 : 500 }}
                    >
                      {s.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Related footage" />
            {incident.clips.length ? (
              incident.clips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void openClip(c.id)}
                  className="relative grid aspect-[16/7] w-full place-items-center bg-video"
                >
                  <Icon name="play_circle" size={40} style={{ color: "rgba(255,255,255,.3)" }} />
                  <Mono className="absolute left-3.5 top-3 text-[11.5px] text-white/70">{c.label}</Mono>
                </button>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-[12.5px] text-faint">No clips linked to this incident.</div>
            )}
          </Card>

          <Card className="px-5 py-[18px]">
            <div className="mb-3 text-[13.5px] font-semibold">Timeline</div>
            <div className="flex flex-col gap-3">
              {incident.events.map((e) => (
                <div key={e.id} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold">
                      {EVENT_TEXT[e.action] ?? e.action.replace(/^STATUS_/, "Status: ").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                      <span className="font-normal text-faint"> · {e.who}</span>
                    </div>
                    {e.note ? <div className="mt-0.5 text-[12.5px] text-muted">{e.note}</div> : null}
                    <Mono className="text-[11px] text-faint">{e.at}</Mono>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-[18px]">
          <Card className="px-5 py-[18px]">
            <div className="mb-3.5 text-[13.5px] font-semibold">Context</div>
            <div className="flex flex-col gap-3">
              <Row label="When" value={incident.occurredAt} mono />
              <div className="h-px bg-line-rule" />
              <Row label="Bus" value={incident.bus} />
              <div className="h-px bg-line-rule" />
              <Row label="Trip" value={incident.trip} />
              <div className="h-px bg-line-rule" />
              <Row label="Driver" value={incident.driver} />
              <div className="h-px bg-line-rule" />
              <Row label="Students onboard" value={incident.onboard} mono />
              <div className="h-px bg-line-rule" />
              <Row label="Assigned to" value={incident.assignedTo} />
            </div>
          </Card>

          {canEdit ? (
            <Card className="px-5 py-[18px]">
              <div className="mb-3 text-[13.5px] font-semibold">Add a note</div>
              <TextInput ariaLabel="Note" value={note} onChange={setNote} placeholder="What was done, who was told" />
              <div className="mt-4 flex gap-2">
                <SecondaryButton
                  className="flex-1 justify-center"
                  disabled={busy || note.trim().length < 2}
                  onClick={() => void change({ note }, `Note added to ${incident.code}`).then(() => setNote(""))}
                >
                  Add note
                </SecondaryButton>
                {nextStep ? (
                  <PrimaryButton
                    className="flex-1 justify-center"
                    disabled={busy}
                    onClick={() =>
                      void change(
                        { status: nextStep.key, ...(note.trim() ? { note } : {}) },
                        `${incident.code} moved to ${nextStep.label.toLowerCase()}`,
                      ).then(() => setNote(""))
                    }
                  >
                    {nextStep.key === "RESOLVED" ? "Mark resolved" : nextStep.key === "CLOSED" ? "Close incident" : `Move to ${nextStep.label.toLowerCase()}`}
                  </PrimaryButton>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className={`text-right text-[12.5px] font-semibold ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
