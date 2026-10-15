"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Card,
  DangerButton,
  Icon,
  Mono,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  TableWrap,
  Td,
  Th,
  Toolbar,
} from "@/components/transport/ui";
import { SelectInput, TextInput } from "@/components/transport/form-controls";
import { api, errorMessage } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { usePoll } from "@/lib/api/use-poll";
import { useAdmin } from "@/lib/transport/admin-store";
import { useStore } from "@/lib/transport/store";
import { pill } from "@/lib/transport/tone";
import type { IncidentRow } from "@/server/services/safety";

interface Feed {
  items: IncidentRow[];
  sos: { id: string; code: string | null; bus: string; busNumber: string; description: string; at: string } | null;
}

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export default function IncidentsPage() {
  const router = useRouter();
  const { dispatch, options } = useStore();
  const { canEdit } = useAdmin();
  const feed = useApi<Feed>("/api/admin/incidents");
  usePoll(feed.reload, 15_000);
  const sos = feed.data?.sos;
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ busId: "", type: "", severity: "MEDIUM", description: "" });
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    try {
      const res = await api.post<{ id: string }>("/api/admin/incidents", form);
      router.push(`/admin/incidents/${res.id}`);
    } catch (error) {
      dispatch({ type: "toast", message: errorMessage(error) });
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Critical SOS banner — shown while a crew SOS is still new. */}
      {sos ? (
      <div className="overflow-hidden rounded-card border border-[#fad2cf] bg-surface">
        <div className="h-[3px] bg-critical" />
        <div className="flex flex-wrap items-center gap-4 px-5 py-[18px]">
          <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] bg-critical-tint text-critical-text">
            <Icon name="emergency_home" size={21} />
          </span>
          <div className="min-w-[240px] flex-1">
            <div className="text-[15px] font-semibold tracking-[-0.01em]">
              Emergency alert · {sos.bus} · <Mono>{sos.at}</Mono>
            </div>
            <div className="mt-0.5 text-[12.5px] text-muted">{sos.description}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/live"
              className="rounded-[9px] border border-line px-[13px] py-[9px] text-[12.5px] font-semibold text-ink-2 hover:bg-canvas"
            >
              Live location
            </Link>
            <Link
              href="/admin/cctv"
              className="rounded-[9px] border border-line px-[13px] py-[9px] text-[12.5px] font-semibold text-ink-2 hover:bg-canvas"
            >
              Open CCTV
            </Link>
            <DangerButton onClick={() => router.push(`/admin/incidents/${sos.id}`)}>
              Respond
            </DangerButton>
          </div>
        </div>
      </div>
      ) : null}

      <Toolbar>
        <span className="text-[13px] text-muted">
          <Mono>{feed.data?.items.length ?? 0}</Mono> incidents
        </span>
        <div className="flex-1" />
        {canEdit ? (
          <PrimaryButton icon="add" onClick={() => setCreating((c) => !c)}>
            Log incident
          </PrimaryButton>
        ) : null}
      </Toolbar>

      {creating ? (
        <Card className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          <SelectInput
            ariaLabel="Bus"
            value={form.busId}
            onChange={(v) => setForm((f) => ({ ...f, busId: v }))}
            options={options.buses}
            placeholder="No bus"
          />
          <TextInput
            ariaLabel="Type"
            value={form.type}
            onChange={(v) => setForm((f) => ({ ...f, type: v }))}
            placeholder="What happened (e.g. Harsh braking)"
          />
          <SelectInput
            ariaLabel="Severity"
            value={form.severity}
            onChange={(v) => setForm((f) => ({ ...f, severity: v || "MEDIUM" }))}
            options={SEVERITIES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))}
            placeholder="Severity"
          />
          <TextInput
            ariaLabel="Description"
            value={form.description}
            onChange={(v) => setForm((f) => ({ ...f, description: v }))}
            placeholder="Describe the incident"
          />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <SecondaryButton onClick={() => setCreating(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={() => void create()} disabled={saving}>
              {saving ? "Saving…" : "Save incident"}
            </PrimaryButton>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <TableWrap minWidth={830}>
          <thead>
            <tr>
              <Th>ID</Th>
              <Th>Bus</Th>
              <Th>Type</Th>
              <Th>Date &amp; time</Th>
              <Th>Severity</Th>
              <Th>Status</Th>
              <Th>Assigned to</Th>
            </tr>
          </thead>
          <tbody>
            {feed.data && feed.data.items.length === 0 ? (
              <tr>
                <Td colSpan={7} className="py-10 text-center text-faint">
                  No incidents recorded.
                </Td>
              </tr>
            ) : null}
            {(feed.data?.items ?? []).map((i) => (
              <tr
                key={i.id}
                className="cursor-pointer hover:bg-[#fafbfc]"
                onClick={() => router.push(`/admin/incidents/${i.id}`)}
              >
                <Td>
                  <Mono className="text-[12.5px] font-semibold text-ink">{i.code}</Mono>
                </Td>
                <Td>
                  <Mono>{i.bus}</Mono>
                </Td>
                <Td className="text-[13px] font-medium text-ink">{i.type}</Td>
                <Td className="text-muted">{i.when}</Td>
                <Td>
                  <span className="text-[11.5px] font-semibold" style={{ color: pill(i.severity.label, i.severity.kind).fg }}>
                    {i.severity.label}
                  </span>
                </Td>
                <Td>
                  <StatusPill pill={pill(i.status.label, i.status.kind)} />
                </Td>
                <Td className="text-muted">{i.assignedTo}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </div>
  );
}
