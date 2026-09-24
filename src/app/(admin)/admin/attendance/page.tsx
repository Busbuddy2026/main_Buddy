"use client";

import { useMemo, useState } from "react";
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
import { hit, studentRows } from "@/lib/transport/derive";
import { useData, useStore } from "@/lib/transport/store";
import { STATUS_GLYPH } from "@/lib/transport/tone";

const SUMMARY = [
  { label: "Expected", value: "1,284", accent: "#16181b" },
  { label: "Boarded", value: "1,196", accent: "#1e8e3e" },
  { label: "Absent", value: "54", accent: "#d93025" },
  { label: "Dropped", value: "1,042", accent: "#1a73e8" },
  { label: "Pending", value: "34", accent: "#f29900" },
];

const TRIPS = ["Trip · Morning", "Trip · Evening", "Trip · Both"] as const;
type TripFilter = (typeof TRIPS)[number];

const STATUS_POOL: Record<TripFilter, string[]> = {
  "Trip · Morning": ["All statuses", "Boarded", "Absent", "Pending"],
  "Trip · Evening": ["All statuses", "Dropped", "Absent", "Pending"],
  "Trip · Both": ["All statuses", "Boarded", "Dropped", "Absent", "Pending"],
};

export default function AttendancePage() {
  const data = useData();
  const { dispatch } = useStore();

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
        {SUMMARY.map((s) => (
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
        <SecondaryButton
          icon="download"
          onClick={() =>
            dispatch({
              type: "toast",
              message: `Attendance for ${rows.length} students exported as CSV`,
            })
          }
        >
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
                </tr>
              ))}
            </tbody>
          </TableWrap>
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
