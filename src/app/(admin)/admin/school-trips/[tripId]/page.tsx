"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { LiveMap } from "@/components/transport/live-map";
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
import { api, errorMessage } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { useAdmin } from "@/lib/transport/admin-store";
import { schoolTripRows } from "@/lib/transport/derive";
import { useData, useRowActions, useStore, type AdminData } from "@/lib/transport/store";
import { pad } from "@/lib/transport/tone";
import type { manifest as loadManifest } from "@/server/services/school-trips";

type Manifest = Awaited<ReturnType<typeof loadManifest>>;

const NEXT_LABEL: Record<string, string> = {
  SCHEDULED: "Schedule trip",
  ON_THE_WAY: "Mark departed",
  AT_VENUE: "Mark arrived at venue",
  RETURNING: "Start return",
  COMPLETED: "Mark back at school",
};

const CONVOY_DOTS = ["#1a73e8", "#f29900", "#1e8e3e", "#9aa0a6"];

export default function SchoolTripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const data = useData();
  const rowActions = useRowActions();
  const { dispatch } = useStore();
  const { canEdit } = useAdmin();
  const man = useApi<Manifest>(`/api/admin/trip-manifests/${tripId}`);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");

  /** Run a trip action; the response refreshes the console's data. */
  const act = async (action: string, body: unknown, done?: string) => {
    try {
      const res = await api.post<{ data: AdminData }>(`/api/admin/school-trips/${tripId}/${action}`, body);
      dispatch({ type: "replaceData", data: res.data });
      await man.reload();
      if (done) dispatch({ type: "toast", message: done });
    } catch (error) {
      dispatch({ type: "toast", message: errorMessage(error) });
    }
  };
  const going = (man.data?.students ?? []).filter((s) => s.onTrip);
  const toggleGoing = (id: string) => {
    const ids = going.map((s) => s.id);
    void act("manifest", { studentIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
  };

  const trips = useMemo(() => schoolTripRows(data), [data]);
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) notFound();

  const actions = rowActions("Trip", trip.name, trip.id);

  const facts: Array<[string, string]> = [
    ["DESTINATION", trip.destination],
    ["DATE", trip.date],
    ["DEPARTURE", trip.depart],
    ["EXPECTED RETURN", trip.ret],
    ["TEACHER IN CHARGE", trip.teacher],
    ["BUSES", trip.busCount],
    ["STUDENTS", trip.studentTotal],
    ["PARENT CONSENT", trip.consent],
  ];

  // Focus the map on the buses assigned to this trip.
  const focusIds =
    trip.fleet
      .map((f) => f.bus.replace("Bus ", ""))
      .filter(Boolean)
      .join(",") || "21";

  const timeline = (man.data?.timeline ?? []).map((j) => ({ time: j.time, title: j.title, done: j.done }));

  return (
    <div className="flex flex-col gap-[18px]">
      <BackLink href="/admin/school-trips">All school trips</BackLink>

      <Card className="px-[22px] py-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <Mono className="text-[11.5px] text-faint">{trip.code}</Mono>
              <StatusPill pill={trip.statusPill} />
            </div>
            <h2 className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em]">{trip.name}</h2>
            <div className="mt-[3px] text-[13px] text-muted">{trip.destination}</div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/school-trips"
              className="rounded-[9px] border border-line px-3.5 py-[9px] text-[12.5px] font-semibold text-ink-2 hover:bg-canvas"
            >
              All trips
            </Link>
            {canEdit ? <SecondaryButton onClick={actions.onEdit}>Edit configuration</SecondaryButton> : null}
            {canEdit && man.data?.next ? (
              <PrimaryButton onClick={() => void act("status", { status: man.data!.next }, "Trip status updated. Parents of students on the trip are notified at each arrival.")}>
                {NEXT_LABEL[man.data.next] ?? "Next step"}
              </PrimaryButton>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-[18px]">
          <div className="relative h-[400px] overflow-hidden rounded-card border border-line bg-[#e8eaed]">
            <LiveMap focus={focusIds} selected={focusIds.split(",")[0]} />
          </div>

          <Card className="px-[22px] py-5">
            <div className="mb-4 text-[13.5px] font-semibold">Trip timeline</div>
            {timeline.map((j, i) => (
              <div key={j.title} className="grid grid-cols-[66px_26px_minmax(0,1fr)] items-start gap-3">
                <Mono className="pt-[3px] text-right text-xs text-muted">{j.time}</Mono>
                <div className="flex flex-col items-center">
                  <span
                    className="grid size-5 place-items-center rounded-full text-white"
                    style={{
                      background: j.done ? "#1e8e3e" : "#fff",
                      border: `2px solid ${j.done ? "#1e8e3e" : "#dadce0"}`,
                    }}
                  >
                    {j.done ? <Icon name="check" size={13} /> : null}
                  </span>
                  {i < timeline.length - 1 ? <div className="h-[30px] w-0.5 bg-line-soft" /> : null}
                </div>
                <div
                  className="pt-px text-[13.5px] font-medium"
                  style={{ color: j.done ? "#16181b" : "#8b919b" }}
                >
                  {j.title}
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div className="flex flex-col gap-[18px]">
          <Card className="px-5 py-[18px]">
            <div className="mb-3.5 text-[13.5px] font-semibold">Configuration</div>
            <div className="grid grid-cols-2 gap-3.5">
              {facts.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <div className="text-[10.5px] tracking-[0.02em] text-faint">{label}</div>
                  <div className="mt-px text-[12.5px] font-medium">{value || "—"}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Buses on this trip"
              action={<span className="text-[11.5px] text-faint">{trip.busCount}</span>}
            />
            {trip.fleet.length ? (
              trip.fleet.map((f, i) => (
                <div key={f.id} className="border-b border-line-rule px-[18px] py-[13px]">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: CONVOY_DOTS[i % CONVOY_DOTS.length] }}
                    />
                    <Mono className="text-[13.5px] font-semibold">{f.bus}</Mono>
                    <span className="flex-1 text-[11px] text-faint">
                      {i === 0 ? "Lead bus" : `Convoy bus ${i + 1}`}
                    </span>
                    <Mono className="text-xs font-semibold">{f.students}</Mono>
                    <span className="sr-only">{pad(i + 1)}</span>
                  </div>
                  <div className="mt-2 flex gap-4 pl-[17px]">
                    <div>
                      <div className="text-[10px] text-faint">DRIVER</div>
                      <div className="text-xs font-medium">{f.driver}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-faint">ATTENDANT</div>
                      <div className="text-xs font-medium">{f.attendant}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-[18px] py-10 text-center text-[12.5px] text-faint">
                No buses assigned yet.
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Students on this trip"
              action={
                <span className="text-[11.5px] text-faint">
                  <Mono>{going.filter((s) => s.consent).length}</Mono> of <Mono>{going.length}</Mono> consented
                </span>
              }
            />
            {going.map((s) => (
              <div key={s.id} className="flex items-center gap-3 border-b border-line-rule px-[18px] py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{s.name}</div>
                  <div className="text-[11px] text-faint">{s.cls}</div>
                </div>
                {canEdit ? (
                  <label className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: s.consent ? "#186c33" : "#8f5b00" }}>
                    <input
                      type="checkbox"
                      checked={s.consent}
                      onChange={(e) => void act("consent", { studentId: s.id, given: e.target.checked })}
                    />
                    {s.consent ? "Consent received" : "Consent pending"}
                  </label>
                ) : (
                  <span className="text-[11.5px] font-semibold" style={{ color: s.consent ? "#186c33" : "#8f5b00" }}>
                    {s.consent ? "Consent received" : "Consent pending"}
                  </span>
                )}
              </div>
            ))}
            {man.data && going.length === 0 ? (
              <div className="px-[18px] py-6 text-center text-[12.5px] text-faint">No students added yet.</div>
            ) : null}
            {canEdit ? (
              <div className="px-[18px] py-3">
                <SecondaryButton icon={picking ? "close" : "group_add"} onClick={() => setPicking((p) => !p)}>
                  {picking ? "Done" : "Add or remove students"}
                </SecondaryButton>
                {picking ? (
                  <div className="mt-3">
                    <input
                      aria-label="Search students"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search by name or class"
                      className="w-full rounded-chip border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-primary"
                    />
                    <div className="mt-2 max-h-[240px] overflow-auto">
                      {(man.data?.students ?? [])
                        .filter((s) => !q || `${s.name} ${s.cls}`.toLowerCase().includes(q.toLowerCase()))
                        .map((s) => (
                          <label key={s.id} className="flex items-center gap-2 py-1 text-[12.5px]">
                            <input type="checkbox" checked={s.onTrip} onChange={() => toggleGoing(s.id)} />
                            <span className="flex-1">{s.name}</span>
                            <span className="text-faint">{s.cls}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card className="px-5 py-[18px]">
            <div className="mb-2.5 text-[13.5px] font-semibold">Notes</div>
            <p className="text-[12.5px] leading-[1.55] text-muted">
              {trip.notes || "No notes recorded for this trip."}
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href="/admin/cctv"
                className="flex-1 rounded-[9px] border border-line py-[9px] text-center text-[12.5px] font-semibold text-ink-2 hover:bg-canvas"
              >
                Live CCTV
              </Link>
              <Link
                href="/admin/incidents"
                className="flex-1 rounded-[9px] border border-line py-[9px] text-center text-[12.5px] font-semibold text-ink-2 hover:bg-canvas"
              >
                Report incident
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
