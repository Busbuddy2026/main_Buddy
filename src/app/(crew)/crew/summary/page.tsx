"use client";

import { useRouter } from "next/navigation";
import { Icon, Mono } from "@/components/transport/ui";
import { CREW_STUDENTS, markKey, studentsAt } from "@/lib/transport/crew";
import { useCrew } from "@/lib/transport/crew-store";
import { pad } from "@/lib/transport/tone";

/** C4 — trip totals and a per-stop breakdown. Completing is blocked while pending. */
export default function CrewSummaryPage() {
  const session = useCrew();
  const router = useRouter();
  const { trip, stops, stopIndex, marks, boardedTotal, droppedTotal, absentTotal, pendingTotal } =
    session;
  const evening = trip === "evening";

  const tiles = [
    { label: "Students boarded", value: String(boardedTotal), fg: "#186c33" },
    {
      label: evening ? "Students dropped" : "Students absent",
      value: String(evening ? droppedTotal : absentTotal),
      fg: evening ? "#1558b8" : "#c5221f",
    },
    { label: "Stops completed", value: `${stopIndex + 1} / ${stops.length}`, fg: "#16181b" },
    {
      label: evening ? "Pending drops" : "Pending",
      value: String(pendingTotal),
      fg: pendingTotal ? "#8f5b00" : "#186c33",
    },
  ];

  return (
    <div className="px-5 pb-6 pt-4">
      <h1 className="text-2xl font-semibold tracking-[-0.025em]">Trip summary</h1>
      <p className="mt-[3px] text-[12.5px] text-faint">
        Bus 12 · {evening ? "Evening trip · School → Kondapur" : "Morning trip · Kondapur → School"}
      </p>

      <div className="mt-[18px] grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-[18px] border border-line px-[18px] py-4">
            <div className="text-xs font-medium text-muted">{t.label}</div>
            <Mono
              className="mt-1 block text-[32px] font-semibold tracking-[-0.03em]"
              style={{ color: t.fg }}
            >
              {t.value}
            </Mono>
          </div>
        ))}
      </div>

      {pendingTotal > 0 ? (
        <div className="mt-4 rounded-[18px] border border-[#fdd9a7] bg-warning-tint px-[18px] py-4">
          <div className="flex items-center gap-2.5">
            <Icon name="warning" size={20} className="shrink-0 text-warning-text" />
            <div className="text-[13.5px] font-semibold text-warning-text">
              {pendingTotal} {pendingTotal === 1 ? "student" : "students"} still unmarked
            </div>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.45] text-warning-text">
            Go back to the stop shown against each student and mark them before completing the trip.
          </p>
        </div>
      ) : null}

      {stops.map((s, i) => {
        const ph = evening && !s.boarding ? "drop" : "board";
        let group = studentsAt(s);
        if (ph === "drop") {
          group = group.filter((x) => {
            const m = marks[markKey("board", x.id)];
            return m && m.status !== "absent";
          });
        }

        return (
          <div key={s.key} className="mt-4 overflow-hidden rounded-[18px] border border-line">
            <button
              type="button"
              onClick={() => {
                session.goToStop(i);
                router.push("/crew/stop");
              }}
              className="flex w-full items-center gap-2.5 border-b border-line-rule px-4 py-[13px] text-left hover:bg-[#fafbfc]"
            >
              <Mono className="text-[10.5px] font-bold text-faint">{pad(i + 1)}</Mono>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{s.name}</span>
              <Mono className="shrink-0 text-[11.5px] text-faint">{s.time}</Mono>
            </button>

            {group.length ? (
              group.map((x) => {
                const m = marks[markKey(ph, x.id)];
                const absent = m?.status === "absent";
                const verb = ph === "drop" ? "Dropped" : "Boarded";
                return (
                  <div
                    key={x.id}
                    className="flex items-center gap-3 border-b border-[#f8f9fa] px-4 py-3"
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold"
                      style={{
                        background: absent ? "#f1f3f4" : m ? "#e6f4ea" : "#f6f7f9",
                        color: absent ? "#8b919b" : m ? "#186c33" : "#8b919b",
                      }}
                    >
                      {x.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium">{x.name}</div>
                      <div className="text-[11.5px] text-faint">{x.cls}</div>
                    </div>
                    <div
                      className="shrink-0 text-xs font-semibold"
                      style={{
                        color: absent ? "#c5221f" : m ? "#186c33" : "#8f5b00",
                      }}
                    >
                      {absent ? "Absent" : m ? `${verb} ${m.time}` : "Pending"}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-5 text-center text-xs text-faint">
                No students at this stop.
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => router.push("/crew/stop")}
        className="mt-4 w-full text-center text-[13px] font-semibold text-primary"
      >
        Back to stops
      </button>
      <span className="sr-only">{CREW_STUDENTS.length} students on this roster</span>
    </div>
  );
}
