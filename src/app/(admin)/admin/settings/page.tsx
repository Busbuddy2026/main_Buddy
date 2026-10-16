"use client";

import { useState } from "react";
import { Card, Icon, Mono, PrimaryButton, SecondaryButton } from "@/components/transport/ui";
import { SelectInput, TextInput } from "@/components/transport/form-controls";
import { api, errorMessage } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import type { SchoolSettings } from "@/lib/api/schemas/settings";
import { ROLE_LABEL, useAdmin, type AdminRole } from "@/lib/transport/admin-store";
import { useStore } from "@/lib/transport/store";

interface Loaded {
  profile: { name: string; phone: string; timezone: string };
  settings: SchoolSettings;
}

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  active: boolean;
  lastLogin: string | null;
}

const NOTIFICATION_TAGS = [
  "Child boarded",
  "Reached school",
  "Boarded return bus",
  "Dropped safely",
  "Marked absent",
  "Attendance corrected",
  "Emergency alert (to the office)",
];

const ROLES = Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }));

/** School profile, trip rules, notification defaults, CCTV retention, staff. */
export default function SettingsPage() {
  const { dispatch } = useStore();
  const { user } = useAdmin();
  const canEdit = user.role === "SUPER_ADMIN" || user.role === "TRANSPORT_MANAGER";
  const loaded = useApi<Loaded>("/api/admin/settings");
  // Unsaved edits; until the first edit the form shows the saved copy.
  const [draft, setForm] = useState<Loaded | null>(null);
  const [saving, setSaving] = useState(false);
  const form = draft ?? loaded.data;

  if (!form) {
    return <Card className="max-w-[860px] px-6 py-14 text-center text-[13px] text-faint">Loading…</Card>;
  }

  const s = form.settings;
  const set = (patch: Partial<SchoolSettings>) => setForm({ ...form, settings: { ...s, ...patch } });

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.patch<Loaded>("/api/admin/settings", {
        profile: { name: form.profile.name, phone: form.profile.phone },
        settings: form.settings,
      });
      setForm(saved);
      void loaded.reload();
      dispatch({ type: "toast", message: "Settings saved." });
    } catch (error) {
      dispatch({ type: "toast", message: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const toggles: Array<{ id: string; title: string; body: string; on: boolean; locked?: boolean; flip?: () => void }> = [
    {
      id: "manual",
      title: "Manual marking by attendant",
      body: "Attendants mark each student boarded, absent or dropped from the bus app. This is the active method.",
      on: true,
      locked: true,
    },
    {
      id: "face",
      title: "Face recognition attendance",
      body: "Automatically detect and verify student boarding using onboard cameras.",
      on: false,
      locked: true,
    },
    {
      id: "drop",
      title: "Require drop confirmation",
      body: "Evening trips cannot be completed until every onboard student is marked dropped.",
      on: s.requireDropConfirm,
      flip: () => set({ requireDropConfirm: !s.requireDropConfirm }),
    },
  ];

  return (
    <div className="flex max-w-[860px] flex-col gap-[18px]">
      <Card className="px-[22px] py-5">
        <div className="mb-1 text-[13.5px] font-semibold">School</div>
        <div className="mb-4 text-xs text-faint">Shown in the three apps and on parent contacts.</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="School name">
            <TextInput ariaLabel="School name" value={form.profile.name} onChange={(v) => setForm({ ...form, profile: { ...form.profile, name: v } })} />
          </Field>
          <Field label="Transport office phone">
            <TextInput ariaLabel="Transport office phone" mono value={form.profile.phone} onChange={(v) => setForm({ ...form, profile: { ...form.profile, phone: v } })} />
          </Field>
        </div>
      </Card>

      <Card className="px-[22px] py-5">
        <div className="mb-1 text-[13.5px] font-semibold">Trips</div>
        <div className="mb-4 text-xs text-faint">Times are in {form.profile.timezone}.</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Morning window">
            <div className="flex items-center gap-2">
              <TextInput ariaLabel="Morning start" mono value={s.morning.start} onChange={(v) => set({ morning: { ...s.morning, start: v } })} />
              <span className="text-faint">to</span>
              <TextInput ariaLabel="Morning end" mono value={s.morning.end} onChange={(v) => set({ morning: { ...s.morning, end: v } })} />
            </div>
          </Field>
          <Field label="Evening window">
            <div className="flex items-center gap-2">
              <TextInput ariaLabel="Evening start" mono value={s.evening.start} onChange={(v) => set({ evening: { ...s.evening, start: v } })} />
              <span className="text-faint">to</span>
              <TextInput ariaLabel="Evening end" mono value={s.evening.end} onChange={(v) => set({ evening: { ...s.evening, end: v } })} />
            </div>
          </Field>
          <Field label="Counts as delayed after (minutes)">
            <TextInput ariaLabel="Delay threshold (minutes)" mono value={String(s.delayThresholdMin)} onChange={(v) => set({ delayThresholdMin: Number(v) || 0 })} />
          </Field>
          <Field label="Attendant can undo a mark for (minutes)">
            <TextInput ariaLabel="Undo window (minutes)" mono value={String(s.undoWindowMin)} onChange={(v) => set({ undoWindowMin: Number(v) || 0 })} />
          </Field>
        </div>
      </Card>

      <Card className="px-[22px] py-5">
        <div className="mb-1 text-[13.5px] font-semibold">Attendance</div>
        <div className="mb-4 text-xs text-faint">How students are marked on and off the bus.</div>
        {toggles.map((r) => (
          <div key={r.id} className="flex items-center gap-3.5 border-t border-line-rule py-3.5">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold" style={{ color: r.locked && !r.on ? "#5f6672" : "#16181b" }}>
                  {r.title}
                </span>
                {r.id === "face" ? (
                  <span className="rounded-[5px] bg-neutral-tint px-1.5 py-[3px] text-[9.5px] font-semibold tracking-[0.05em] text-muted">
                    COMING SOON
                  </span>
                ) : null}
              </div>
              <p className="mt-[3px] text-xs leading-[1.5] text-faint text-pretty">{r.body}</p>
            </div>
            <Switch label={r.title} on={r.on} disabled={r.locked || !canEdit} onFlip={r.flip} />
          </div>
        ))}
      </Card>

      <Card className="px-[22px] py-5">
        <div className="mb-1 text-[13.5px] font-semibold">Parent notifications</div>
        <div className="mb-3.5 text-xs text-faint">
          Sent to the parent app automatically. Each parent can turn groups off in their profile.
        </div>
        <div className="flex flex-wrap gap-2">
          {NOTIFICATION_TAGS.map((n) => (
            <span key={n} className="flex items-center gap-1.5 rounded-pill bg-primary-tint px-3 py-[7px] text-xs font-medium text-primary-hover">
              <Icon name="check" size={15} />
              {n}
            </span>
          ))}
        </div>
        <div className="mt-4 text-[12px] font-semibold text-muted">Defaults for newly added parents</div>
        {(
          [
            ["alerts", "Boarding and drop alerts"],
            ["absence", "Delay and route changes"],
            ["digest", "Weekly summary"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between border-t border-line-rule py-2.5">
            <span className="text-[12.5px]">{label}</span>
            <Switch label={label} on={s.notify[key]} disabled={!canEdit} onFlip={() => set({ notify: { ...s.notify, [key]: !s.notify[key] } })} />
          </div>
        ))}
      </Card>

      <Card className="px-[22px] py-5">
        <div className="mb-1 text-[13.5px] font-semibold">CCTV access</div>
        <div className="mb-3.5 text-xs text-faint">
          Live footage is limited to authorised school staff, and every view is logged. Parents receive
          incident-linked clips only on request.
        </div>
        <div className="flex flex-col gap-[11px]">
          <Row label="Live view roles" value="Super admin, Transport manager, Office staff" />
          <div className="h-px bg-line-rule" />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-muted">Retention on device</span>
            <SelectInput
              ariaLabel="Retention"
              className="!w-[140px]"
              value={String(s.retentionDays)}
              onChange={(v) => set({ retentionDays: Number(v) || 30 })}
              options={[7, 15, 30, 60, 90].map((d) => ({ value: String(d), label: `${d} days` }))}
              placeholder="Retention"
            />
          </div>
          <div className="h-px bg-line-rule" />
          <Row label="Access log" value="Always on" />
        </div>
      </Card>

      {canEdit ? (
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={() => setForm(null)}>Discard changes</SecondaryButton>
          <PrimaryButton onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </PrimaryButton>
        </div>
      ) : null}

      {canEdit ? <TrackingCard /> : null}

      {user.role === "SUPER_ADMIN" ? <StaffCard /> : null}
    </div>
  );
}

interface Trackers {
  configured: boolean;
  vehicles: Array<{
    vehicleId: string;
    vehicleNo: string;
    imei: string;
    dashcamChannels: number;
    status: string | null;
    lastFix: string | null;
    busId: string | null;
    bus: string | null;
  }>;
}

/** Link each vendor tracker (GPS + dashcam) to one of the school's buses. */
function TrackingCard() {
  const { dispatch, options } = useStore();
  const trackers = useApi<Trackers>("/api/admin/tracking/vehicles");
  const [pick, setPick] = useState<Record<string, string>>({});

  const link = async (busId: string, vehicleId: string | null, label: string) => {
    try {
      await api.put("/api/admin/tracking/links", { busId, vehicleId });
      await trackers.reload();
      dispatch({ type: "toast", message: label });
    } catch (error) {
      dispatch({ type: "toast", message: errorMessage(error) });
    }
  };

  return (
    <Card className="px-[22px] py-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-[13.5px] font-semibold">Tracking provider · LivePin</div>
        <SecondaryButton icon="sync" onClick={() => void trackers.reload()}>
          Test connection
        </SecondaryButton>
      </div>
      <div className="mb-3.5 text-xs text-faint">
        GPS and dashcams on the buses. Link each tracker to its bus; positions refresh every minute.
      </div>
      {trackers.error ? (
        <div role="alert" className="rounded-control bg-critical-tint px-3 py-2.5 text-[12.5px] font-medium text-critical-text">
          {trackers.error}
        </div>
      ) : null}
      {trackers.data && !trackers.data.configured ? (
        <div className="text-[12.5px] text-muted">Not configured. Set LIVEPIN_API_KEY and LIVEPIN_API_SECRET on the server.</div>
      ) : null}
      {trackers.data?.configured ? (
        <div className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-success-text">
          <Icon name="check_circle" size={16} /> Connected · {trackers.data.vehicles.length} tracker
          {trackers.data.vehicles.length === 1 ? "" : "s"}
        </div>
      ) : null}
      {(trackers.data?.vehicles ?? []).map((v) => (
        <div key={v.vehicleId} className="flex flex-wrap items-center gap-3 border-t border-line-rule py-3">
          <div className="min-w-0 flex-1">
            <Mono className="block text-[13px] font-semibold">{v.vehicleNo}</Mono>
            <div className="text-[11.5px] text-faint">
              IMEI <Mono>{v.imei}</Mono> · {v.dashcamChannels ? `${v.dashcamChannels}-channel dashcam` : "GPS only"} ·{" "}
              {v.lastFix ? `last fix ${new Date(v.lastFix).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : "no fix yet"}
            </div>
          </div>
          {v.busId ? (
            <>
              <span className="text-[12.5px] font-semibold">Linked to {v.bus}</span>
              <SecondaryButton onClick={() => void link(v.busId!, null, `${v.vehicleNo} unlinked.`)}>Unlink</SecondaryButton>
            </>
          ) : (
            <>
              <SelectInput
                ariaLabel={`Bus for ${v.vehicleNo}`}
                className="!w-[150px]"
                value={pick[v.vehicleId] ?? ""}
                onChange={(busId) => setPick((p) => ({ ...p, [v.vehicleId]: busId }))}
                options={options.buses}
                placeholder="Choose bus"
              />
              <PrimaryButton
                disabled={!pick[v.vehicleId]}
                onClick={() => void link(pick[v.vehicleId]!, v.vehicleId, `${v.vehicleNo} linked.`)}
              >
                Link
              </PrimaryButton>
            </>
          )}
        </div>
      ))}
    </Card>
  );
}

function StaffCard() {
  const { dispatch } = useStore();
  const { user } = useAdmin();
  const staff = useApi<StaffUser[]>("/api/admin/users");
  const [draft, setDraft] = useState({ name: "", email: "", role: "OFFICE_STAFF" });

  const run = async (work: () => Promise<string>) => {
    try {
      dispatch({ type: "toast", message: await work() });
      await staff.reload();
    } catch (error) {
      dispatch({ type: "toast", message: errorMessage(error) });
    }
  };

  return (
    <Card className="px-[22px] py-5">
      <div className="mb-1 text-[13.5px] font-semibold">Staff accounts</div>
      <div className="mb-4 text-xs text-faint">Who can sign in to this console, and what they can change.</div>
      {(staff.data ?? []).map((u) => (
        <div key={u.id} className="flex flex-wrap items-center gap-3 border-t border-line-rule py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold" style={{ color: u.active ? "#16181b" : "#8b919b" }}>
              {u.name} {u.id === user.id ? <span className="font-normal text-faint">(you)</span> : null}
            </div>
            <Mono className="text-[11.5px] text-faint">{u.email}</Mono>
          </div>
          <SelectInput
            ariaLabel={`Role for ${u.name}`}
            className="!w-[170px]"
            value={u.role}
            onChange={(role) => role && void run(async () => {
              await api.patch(`/api/admin/users/${u.id}`, { role });
              return `${u.name} is now ${ROLE_LABEL[role as AdminRole].toLowerCase()}.`;
            })}
            options={ROLES}
            placeholder="Role"
          />
          {u.id !== user.id ? (
            <SecondaryButton
              onClick={() =>
                void run(async () => {
                  await api.patch(`/api/admin/users/${u.id}`, { active: !u.active });
                  return u.active ? `${u.name} can no longer sign in.` : `${u.name} can sign in again.`;
                })
              }
            >
              {u.active ? "Deactivate" : "Reactivate"}
            </SecondaryButton>
          ) : null}
        </div>
      ))}
      <div className="mt-3 grid gap-2 border-t border-line-rule pt-3 sm:grid-cols-[1fr_1fr_170px_auto]">
        <TextInput ariaLabel="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Full name" />
        <TextInput ariaLabel="Email" value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} placeholder="name@school.edu.in" />
        <SelectInput ariaLabel="Role" value={draft.role} onChange={(v) => setDraft({ ...draft, role: v || "OFFICE_STAFF" })} options={ROLES} placeholder="Role" />
        <PrimaryButton
          icon="person_add"
          onClick={() =>
            void run(async () => {
              const res = await api.post<{ password: string }>("/api/admin/users", draft);
              setDraft({ name: "", email: "", role: "OFFICE_STAFF" });
              return `Account created. One-time password: ${res.password}`;
            })
          }
        >
          Add
        </PrimaryButton>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10.5px] font-semibold tracking-[0.03em] text-faint">{label.toUpperCase()}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="text-right text-[12.5px] font-semibold">{value}</span>
    </div>
  );
}

function Switch({ label, on, disabled, onFlip }: { label: string; on: boolean; disabled?: boolean; onFlip?: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onFlip}
      className={`relative h-[23px] w-10 shrink-0 rounded-pill transition-colors ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
      style={{ background: on ? "#1a73e8" : "#e4e7eb" }}
    >
      <span className="absolute top-[3px] size-[17px] rounded-full bg-white transition-all" style={{ left: on ? "20px" : "3px" }} />
    </button>
  );
}
