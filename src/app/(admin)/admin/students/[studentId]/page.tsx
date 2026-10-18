"use client";

import { notFound, useParams } from "next/navigation";
import {
  Avatar,
  BackLink,
  Card,
  Icon,
  Mono,
  StatusPill,
} from "@/components/transport/ui";
import { useApi } from "@/lib/api/use-api";
import { useData } from "@/lib/transport/store";
import { STATUS_KIND, pill } from "@/lib/transport/tone";
import { formatWeekday } from "@/lib/time";
import type { StudentJourney } from "@/lib/api/types";

export default function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const data = useData();
  const journey = useApi<StudentJourney>(`/api/admin/attendance/students/${studentId}`);
  const j30 = journey.data?.last30;

  const student = data.students.find((s) => s.id === studentId);
  if (!student) notFound();

  const attendant =
    data.attendants.find((a) => a.bus === student.bus)?.name ?? "Unassigned";
  const parentInitials = student.parent
    .split(" ")
    .map((w) => w.charAt(0))
    .join("");

  return (
    <div className="flex flex-col gap-[18px]">
      <BackLink href="/admin/students">All students</BackLink>

      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-[18px]">
          <Card className="px-[22px] py-5">
            <div className="flex flex-wrap items-center gap-3.5">
              <Avatar initial={student.name.charAt(0)} size={46} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-semibold tracking-[-0.02em]">{student.name}</h2>
                <div className="text-[12.5px] text-faint">
                  {student.cls}
                  {journey.data?.roll ? ` · Roll ${journey.data.roll}` : ""}
                  {student.bus ? " · Transport active" : " · No bus assigned"}
                </div>
              </div>
              <StatusPill pill={pill(student.am === "Boarded" ? "Onboard now" : student.am, STATUS_KIND[student.am] ?? "offline")} />
            </div>
          </Card>

          <Card className="px-[22px] py-5">
            <div className="mb-[18px] flex items-center justify-between gap-3">
              <div className="text-[13.5px] font-semibold">Today&apos;s transport</div>
              <div className="text-xs text-faint">{journey.data ? formatWeekday(journey.data.today) : ""}</div>
            </div>
            {journey.error ? (
              <div className="text-[12.5px] text-critical-text">{journey.error}</div>
            ) : !journey.data ? (
              <div className="text-[12.5px] text-faint">Loading…</div>
            ) : journey.data.events.length === 0 ? (
              <div className="text-[12.5px] text-muted">No boarding or drop marked today.</div>
            ) : (
              journey.data.events.map((j, i, all) => (
                <div key={j.id} className="grid grid-cols-[66px_26px_minmax(0,1fr)] items-start gap-3">
                  <Mono className="pt-[3px] text-right text-xs text-muted">{j.time}</Mono>
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid size-5 place-items-center rounded-full border-2 text-white ${
                        j.absent ? "border-critical bg-critical" : "border-success bg-success"
                      }`}
                    >
                      <Icon name={j.absent ? "close" : "check"} size={13} />
                    </span>
                    {i < all.length - 1 ? <div className="h-[34px] w-0.5 bg-line-soft" /> : null}
                  </div>
                  <div className="pt-px">
                    <div className="text-[13.5px] font-medium">{j.title}</div>
                    <div className="mt-0.5 text-[11.5px] text-faint">{j.by}</div>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-[18px]">
          <Card className="px-5 py-[18px]">
            <div className="mb-3.5 text-[13.5px] font-semibold">Transport assignment</div>
            <div className="flex flex-col gap-3">
              <AssignRow label="Bus" value={student.bus || "Unassigned"} />
              <div className="h-px bg-line-rule" />
              <AssignRow label="Route" value={student.route || "Unassigned"} />
              <div className="h-px bg-line-rule" />
              <AssignRow label="Stop" value={student.stop || "Unassigned"} />
              <div className="h-px bg-line-rule" />
              <AssignRow label="Attendant" value={attendant} />
            </div>
          </Card>

          <Card className="px-5 py-[18px]">
            <div className="mb-3.5 text-[13.5px] font-semibold">Parent</div>
            <div className="flex items-center gap-[11px]">
              <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-neutral-tint text-[13px] font-semibold text-muted">
                {parentInitials}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{student.parent}</div>
                <Mono className="block text-[11.5px] text-faint">{student.phone}</Mono>
              </div>
              <a
                href={`tel:${student.phone.replace(/\s/g, "")}`}
                aria-label={`Call ${student.parent}`}
                className="ml-auto grid size-[34px] shrink-0 place-items-center rounded-[9px] border border-line text-muted hover:bg-canvas"
              >
                <Icon name="call" size={17} />
              </a>
            </div>
          </Card>

          <Card className="px-5 py-[18px]">
            <div className="mb-3 text-[13.5px] font-semibold">Attendance · last 30 days</div>
            <div className="grid grid-cols-3 gap-3">
              <Metric value={j30 ? String(j30.boarded) : "—"} label="boarded" />
              <Metric value={j30 ? String(j30.absent) : "—"} label="absent" />
              <Metric value={j30 ? String(j30.unmarked) : "—"} label="unmarked" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AssignRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span className="text-right text-[12.5px] font-semibold">{value}</span>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <Mono className="block text-[22px] font-medium">{value}</Mono>
      <div className="text-[11.5px] text-faint">{label}</div>
    </div>
  );
}
