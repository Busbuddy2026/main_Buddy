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
import { useData } from "@/lib/transport/store";
import { STATUS_KIND, pill } from "@/lib/transport/tone";

/** Today's journey. Sourced from AttendanceMark once the database is wired. */
const JOURNEY = [
  { time: "6:42 AM", title: "Boarded bus at Green Valley Apartments", by: "Marked by Suresh Kumar · Bus 12", done: true },
  { time: "7:35 AM", title: "Reached school", by: "Trip completed · Bus 12", done: true },
  { time: "3:48 PM", title: "Boarded return bus", by: "Marked by Suresh Kumar · Bus 12", done: true },
  { time: "4:32 PM", title: "Dropped safely at Green Valley Apartments", by: "Marked by Suresh Kumar · Bus 12", done: false },
];

export default function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const data = useData();

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
                  {student.cls} · Roll 24 · Transport active
                </div>
              </div>
              <StatusPill pill={pill(student.am === "Boarded" ? "Onboard now" : student.am, STATUS_KIND[student.am] ?? "offline")} />
            </div>
          </Card>

          <Card className="px-[22px] py-5">
            <div className="mb-[18px] flex items-center justify-between gap-3">
              <div className="text-[13.5px] font-semibold">Today&apos;s transport</div>
              <div className="text-xs text-faint">Tuesday, 8 September</div>
            </div>
            {JOURNEY.map((j, i) => (
              <div key={j.time} className="grid grid-cols-[66px_26px_minmax(0,1fr)] items-start gap-3">
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
                  {i < JOURNEY.length - 1 ? <div className="h-[34px] w-0.5 bg-line-soft" /> : null}
                </div>
                <div className="pt-px">
                  <div
                    className="text-[13.5px] font-medium"
                    style={{ color: j.done ? "#16181b" : "#8b919b" }}
                  >
                    {j.title}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-faint">{j.by}</div>
                </div>
              </div>
            ))}
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
            <div className="mt-3.5 rounded-control bg-canvas px-3 py-[11px] text-xs text-muted">
              Parent app active · notifications delivered for all 4 events today.
            </div>
          </Card>

          <Card className="px-5 py-[18px]">
            <div className="mb-3 text-[13.5px] font-semibold">Attendance · last 30 days</div>
            <div className="grid grid-cols-3 gap-3">
              <Metric value="27" label="boarded" />
              <Metric value="2" label="absent" />
              <Metric value="0" label="unmarked" />
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
