"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Card,
  Dropdown,
  EmptyState,
  Icon,
  Mono,
  SearchBox,
  SecondaryButton,
  TableWrap,
  Td,
  Th,
  Toolbar,
} from "@/components/transport/ui";
import { api, errorMessage } from "@/lib/api/client";
import { usePoll } from "@/lib/api/use-poll";
import { useAdmin } from "@/lib/transport/admin-store";
import { hit, studentRows } from "@/lib/transport/derive";
import { useData, useStore } from "@/lib/transport/store";
import { STATUS_GLYPH } from "@/lib/transport/tone";
import { localDate } from "@/lib/time";

interface Summary {
  expected: number;
  boarded: number;
  absent: number;
  dropped: number;
  pending: number;
}

interface Absence {
  id: string;
  student: string;
  cls: string;
  bus: string;
  dateLabel: string;
  phase: "am" | "pm" | "both";
  reason: string | null;
  parent: string;
  acknowledged: boolean;
}

const PHASE_LABEL = { am: "Morning", pm: "Evening", both: "Both trips" } as const;
const num = (n: number | undefined) => (n === undefined ? "—" : n.toLocaleString("en-IN"));

const TRIPS = ["Trip · Morning", "Trip · Evening", "Trip · Both"] as const;
type TripFilter = (typeof TRIPS)[number];

const STATUS_POOL: Record<TripFilter, string[]> = {
  "Trip · Morning": ["All statuses", "Boarded", "Absent", "Pending"],
  "Trip · Evening": ["All statuses", "Dropped", "Absent", "Pending"],
  "Trip · Both": ["All statuses", "Boarded", "Dropped", "Absent", "Pending"],
};

export default function AttendancePage() {
  const data = useData();
  const { dispatch, actions } = useStore();
  const { canEdit } = useAdmin();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [absences, setAbsences] = useState<Absence[]>([]);

  // Live-ish: the table and the tallies refresh every 15 seconds.
  const load = useCallback(async () => {
    try {
      const res = await api.get<{ summary: Summary; absences: Absence[] }>("/api/admin/attendance/today");
      setSummary(res.summary);
      setAbsences(res.absences);
    } catch {
      // Keep the last numbers; the next tick retries.
    }
  }, []);
  usePoll(
    useCallback(async () => {
      await Promise.all([load(), actions.refresh()]);
    }, [load, actions]),
  );

  const cards = [
    { label: "Expected", value: num(summary?.expected), accent: "#16181b" },
    { label: "Boarded", value: num(summary?.boarded), accent: "#1e8e3e" },
    { label: "Absent", value: num(summary?.absent), accent: "#d93025" },
    { label: "Dropped", value: num(summary?.dropped), accent: "#1a73e8" },
    { label: "Pending", value: num(summary?.pending), accent: "#f29900" },
  ];

  const acknowledge = async (id: string) => {
    try {
      await api.post(`/api/admin/absences/${id}/acknowledge`);
      setAbsences((list) => list.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
    } catch (error) {
      dispatch({ type: "toast", message: errorMessage(error) });
    }
  };

  /** Office correction for today's record (the crew's undo window has passed). */
  const correct = async (studentId: string, phase: "morning" | "evening", value: string) => {
    const status = value === "Clear" ? null : (value.toLowerCase() as "boarded" | "dropped" | "absent");
    // Only a drop is recorded against the drop; boarding and absence are the board.
    const markPhase = status === "dropped" ? "drop" : "board";
    const note = window.prompt("Reason for the correction (kept in the audit log):");
    if (!note) return;
    try {
      await api.post("/api/admin/attendance/correct", {
        studentId, date: localDate(), phase, markPhase, status, note,
      });
      await Promise.all([load(), actions.refresh()]);
      dispatch({ type: "toast", message: "Attendance corrected. The parent has been notified." });
    } catch (error) {
      dispatch({ type: "toast", message: errorMessage(error) });
    }
  };

  const [q, setQ] = useState("");
  const [bus, setBus] = useState("All buses");
  const [trip, setTrip] = useState<TripFilter>("Trip · Morning");
  const [status, setStatus] = useState("All statuses");
  const [menu, setMenu] = useState<"" | "bus" | "trip" | "status">("");

  const all = useMemo(() => studentRows(data), [data]);
  const busOptions = ["All buses", ...data.buses.map((b) => `Bus ${b.id}`)];
  const statusOptions = STATUS_POOL[trip];

  const rows = all.filter((s) => {
    if (!hit(q, s.name, s.cls, s.stop, s.bus)) return false;
    if (bus !== "All buses" && `Bus ${s.bus.replace(/^Bus /, "")}` !== bus) return false;
    if (status !== "All statuses") {
      const pool =
        trip === "Trip · Morning"
          ? [s.amPill.label]
          : trip === "Trip · Evening"
            ? [s.pmPill.label]
            : [s.amPill.label, s.pmPill.label];
      if (!pool.some((x) => x.toLowerCase().includes(status.toLowerCase()))) return false;
    }
    return true;
  });

  const clear = () => {
    setQ("");
    setBus("All buses");
    setTrip("Trip · Morning");
    setStatus("All statuses");
    setMenu("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((s) => (
          <Card key={s.label} className="px-[17px] py-[15px]">
            <div className="text-xs font-medium text-muted">{s.label}</div>
            <Mono
              className="mt-1 block text-[28px] font-medium tracking-[-0.03em]"
              style={{ color: s.accent }}
            >
              {s.value}
            </Mono>
          </Card>
        ))}
      </div>

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search student" width={200} />
        <Dropdown
          value={bus}
          options={busOptions}
          width={150}
          open={menu === "bus"}
          onToggle={() => setMenu((m) => (m === "bus" ? "" : "bus"))}
          onChange={(v) => {
            setBus(v);
            setMenu("");
          }}
        />
        <Dropdown
          value={trip}
          options={[...TRIPS]}
          width={160}
          open={menu === "trip"}
          onToggle={() => setMenu((m) => (m === "trip" ? "" : "trip"))}
          onChange={(v) => {
            setTrip(v as TripFilter);
            // Status vocabularies differ per trip phase, so reset on change.
            setStatus("All statuses");
            setMenu("");
          }}
        />
        <Dropdown
          value={status}
          options={statusOptions}
          width={155}
          open={menu === "status"}
          onToggle={() => setMenu((m) => (m === "status" ? "" : "status"))}
          onChange={(v) => {
            setStatus(v);
            setMenu("");
          }}
        />
        <div className="flex-1" />
        <span className="text-xs text-faint">
          {rows.length} of {all.length} students
        </span>
        <SecondaryButton icon="download" href={`/api/admin/attendance/export?from=${localDate()}&to=${localDate()}`}>
          Export CSV
        </SecondaryButton>
      </Toolbar>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState title="No students match these filters" onClear={clear} />
        ) : (
          <TableWrap minWidth={750}>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Bus</Th>
                <Th>Stop</Th>
                <Th>Boarded</Th>
                <Th>Dropped</Th>
                <Th align="right">Updated</Th>
                {canEdit ? <Th align="right">Correct</Th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-[#fafbfc]">
                  <Td>
                    <div className="text-[13px] font-medium text-ink">{s.name}</div>
                    <div className="text-[11.5px] text-faint">{s.cls}</div>
                  </Td>
                  <Td>
                    <Mono>{s.bus}</Mono>
                  </Td>
                  <Td className="max-w-[180px] truncate text-muted">{s.stop || "—"}</Td>
                  <Td>
                    <span
                      className="flex items-center gap-1.5 text-[12.5px] font-semibold"
                      style={{ color: s.amPill.fg }}
                    >
                      <Icon name={STATUS_GLYPH[s.amPill.label] ?? "radio_button_unchecked"} size={17} />
                      {s.amPill.label}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className="flex items-center gap-1.5 text-[12.5px] font-semibold"
                      style={{ color: s.pmPill.fg }}
                    >
                      <Icon name={STATUS_GLYPH[s.pmPill.label] ?? "radio_button_unchecked"} size={17} />
                      {s.pmPill.label}
                    </span>
                  </Td>
                  <Td align="right">
                    <Mono className="text-[11.5px] text-faint">{s.updated}</Mono>
                  </Td>
                  {canEdit ? (
                    <Td align="right">
                      <select
                        aria-label={`Correct attendance for ${s.name}`}
                        value=""
                        onChange={(e) => {
                          const [phase, value] = e.target.value.split(":") as ["morning" | "evening", string];
                          if (value) void correct(s.id, phase, value);
                        }}
                        className="rounded-chip border border-line bg-surface px-2 py-1 text-[12px] text-ink-2"
                      >
                        <option value="">Edit…</option>
                        <optgroup label="Morning">
                          <option value="morning:Boarded">Boarded</option>
                          <option value="morning:Absent">Absent</option>
                          <option value="morning:Clear">Clear</option>
                        </optgroup>
                        <optgroup label="Evening">
                          <option value="evening:Boarded">Boarded at school</option>
                          <option value="evening:Dropped">Dropped</option>
                          <option value="evening:Absent">Absent</option>
                        </optgroup>
                      </select>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
          <div>
            <div className="text-[13.5px] font-semibold">Absence notices from parents</div>
            <div className="text-xs text-faint">Today and upcoming. Crew rosters already skip these students.</div>
          </div>
          <Mono className="text-xs text-faint">{absences.filter((a) => !a.acknowledged).length} new</Mono>
        </div>
        {absences.length === 0 ? (
          <div className="px-5 py-6 text-center text-[12.5px] text-faint">No absence notices.</div>
        ) : (
          absences.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-line-rule px-5 py-3 last:border-b-0">
              <Icon name="event_busy" size={19} className="shrink-0 text-faint" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">
                  {a.student} <span className="text-faint">· {a.cls} · {a.bus}</span>
                </div>
                <div className="truncate text-[11.5px] text-faint">
                  <Mono>{a.dateLabel}</Mono> · {PHASE_LABEL[a.phase]} · from {a.parent}
                  {a.reason ? ` · ${a.reason}` : ""}
                </div>
              </div>
              {a.acknowledged ? (
                <span className="text-[11.5px] font-semibold text-success-text">Seen</span>
              ) : canEdit ? (
                <SecondaryButton icon="done" onClick={() => void acknowledge(a.id)}>
                  Acknowledge
                </SecondaryButton>
              ) : null}
            </div>
          ))
        )}
      </Card>

      {/* Face recognition is explicitly out of scope — the control stays locked. */}
      <Card className="flex items-center gap-3.5 px-5 py-[18px]">
        <span className="grid size-[34px] shrink-0 place-items-center rounded-control bg-neutral-tint text-faint">
          <Icon name="lock" size={19} />
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold text-muted">
              Face recognition attendance
            </span>
            <span className="rounded-[5px] bg-neutral-tint px-1.5 py-[3px] text-[9.5px] font-semibold tracking-[0.05em] text-muted">
              COMING SOON
            </span>
          </div>
          <div className="mt-0.5 text-xs text-faint">
            Automatically detect and verify student boarding using onboard cameras. Attendance stays
            manual for now.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={false}
          aria-label="Face recognition attendance (coming soon)"
          disabled
          className="relative h-[23px] w-10 shrink-0 cursor-not-allowed rounded-pill bg-line"
        >
          <span className="absolute left-[3px] top-[3px] size-[17px] rounded-full bg-white" />
        </button>
      </Card>
    </div>
  );
}
