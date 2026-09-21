"use client";

import { useEffect, useRef, useState } from "react";
import { LiveMap } from "@/components/transport/live-map";
import { Icon, Mono } from "@/components/transport/ui";
import { CREW, markKey, studentsAt } from "@/lib/transport/crew";
import { rosterFor, useCrew } from "@/lib/transport/crew-store";
import { pad } from "@/lib/transport/tone";

/** C3 — stop-by-stop marking, with a driving view and the SOS flow. */
export default function CrewStopPage() {
  const session = useCrew();
  const { stop, phase, stops, stopIndex, trip, marks, sos, isLastStop } = session;
  const [view, setView] = useState<"students" | "route">("students");
  // Advancing a stop from the action bar must bring its chip into view — the
  // attendant is holding a handrail, not hunting for it in a side-scroller.
  const stripRef = useRef<HTMLDivElement | null>(null);

  const evening = trip === "evening";
  const roster = rosterFor(session, stop, phase);
  const marked = roster.filter((r) => r.settled).length;
  const nextStop = isLastStop
    ? evening
      ? "Trip ends here"
      : "Bharath Vidya Mandir"
    : stops[stopIndex + 1].name;

  useEffect(() => {
    const chip = stripRef.current?.children[stopIndex];
    chip?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [stopIndex]);

  return (
    <div className="px-5 pb-6 pt-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-primary-tint px-[11px] py-[5px] text-xs font-semibold text-primary-hover">
          <span className="size-1.5 rounded-full bg-primary" />
          Trip active
        </span>
        <Mono className="text-xs text-faint">
          BUS 12 · {evening ? "EVENING" : "MORNING"}
        </Mono>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-[5px] rounded-xl bg-neutral-tint p-1">
        {(
          [
            ["students", "Students"],
            ["route", "Driving"],
          ] as const
        ).map(([id, label]) => {
          const on = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={on}
              className="rounded-[9px] py-2.5 text-center text-[13px] font-semibold"
              style={{ background: on ? "#16181b" : "transparent", color: on ? "#fff" : "#5f6672" }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        ref={stripRef}
        // Bleeds to the screen edge so a half-visible chip reads as "scroll me".
        className="-mx-5 mt-4 flex snap-x gap-2 overflow-x-auto overflow-y-hidden px-5 pb-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {stops.map((s, i) => {
          const ph = evening && !s.boarding ? "drop" : "board";
          let group = studentsAt(s);
          if (ph === "drop") {
            group = group.filter((x) => {
              const m = marks[markKey("board", x.id)];
              return m && m.status !== "absent";
            });
          }
          const left = group.filter((x) => !marks[markKey(ph, x.id)]).length;
          const done = group.length > 0 && left === 0;
          const current = i === stopIndex;

          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                session.goToStop(i);
                setView("students");
              }}
              aria-current={current ? "step" : undefined}
              className="min-h-11 shrink-0 snap-start rounded-xl border px-[13px] py-[9px] text-left"
              style={{
                borderColor: current ? "#1a73e8" : "#e4e7eb",
                background: current ? "#f7faff" : "#fff",
              }}
            >
              <span className="flex items-center gap-1.5">
                <Mono
                  className="text-[10.5px] font-bold"
                  style={{ color: current ? "#1a73e8" : "#8b919b" }}
                >
                  {pad(i + 1)}
                </Mono>
                <span
                  className="text-[12.5px] font-semibold"
                  style={{ color: current ? "#1558b8" : "#3c4149" }}
                >
                  {s.short}
                </span>
                {done ? <Icon name="check_circle" size={15} className="text-success" /> : null}
              </span>
              <Mono className="mt-0.5 block text-[10.5px] text-faint">
                {group.length === 0
                  ? "no students"
                  : done
                    ? "all marked"
                    : `${left} ${ph === "drop" ? "to drop" : "pending"}`}
              </Mono>
            </button>
          );
        })}
      </div>

      {view === "students" ? (
        <>
          <div className="mt-3.5 rounded-[20px] border border-line px-5 py-[18px]">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold tracking-[0.06em] text-faint">
                {stop.boarding ? "BOARDING AT" : evening ? "DROPPING AT" : "CURRENT STOP"}
              </div>
              <Mono className="text-[11.5px] text-faint">
                STOP {stopIndex + 1} OF {stops.length}
              </Mono>
            </div>
            <div className="mt-[5px] text-2xl font-semibold tracking-[-0.025em]">{stop.name}</div>
            <div className="mt-3.5 flex items-center gap-[18px] border-t border-line-rule pt-3.5">
              <div>
                <div className="text-[11px] text-faint">
                  {phase === "drop" ? "TO DROP" : "EXPECTED"}
                </div>
                <Mono className="text-[19px] font-semibold">{roster.length}</Mono>
              </div>
              <div>
                <div className="text-[11px] text-faint">MARKED</div>
                <Mono className="text-[19px] font-semibold text-success">{marked}</Mono>
              </div>
              <div className="min-w-0 flex-1 text-right">
                <div className="text-[11px] text-faint">NEXT</div>
                <div className="truncate text-[13px] font-semibold">{nextStop}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {roster.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-line px-4 py-10 text-center">
                <div className="text-[13px] font-semibold">No students at this stop</div>
                <div className="mt-1 text-xs text-faint">Carry on to the next stop.</div>
              </div>
            ) : null}

            {roster.map((s) => (
              <div
                key={s.id}
                className="rounded-[18px] border px-4 py-[15px]"
                style={{
                  borderColor: s.settled ? "#eceef1" : "#e4e7eb",
                  background: s.settled || s.blocked ? "#fbfcfc" : "#fff",
                }}
              >
                <div className="flex items-center gap-[13px]">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-full text-base font-semibold"
                    style={{
                      background:
                        s.mark?.status === "absent"
                          ? "#f1f3f4"
                          : s.settled
                            ? "#e6f4ea"
                            : s.blocked
                              ? "#f1f3f4"
                              : "#e8f0fe",
                      color:
                        s.mark?.status === "absent"
                          ? "#8b919b"
                          : s.settled
                            ? "#186c33"
                            : s.blocked
                              ? "#8b919b"
                              : "#1558b8",
                    }}
                  >
                    {s.initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold tracking-[-0.01em]">
                      {s.name}
                    </div>
                    <div className="text-[12.5px] text-faint">{s.cls}</div>
                  </div>
                  {s.settled ? (
                    <span
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-[7px] text-[12.5px] font-semibold"
                      style={{ background: s.tone.bg, color: s.tone.fg }}
                    >
                      <Icon name={s.glyph} size={17} />
                      {s.statusText}
                    </span>
                  ) : null}
                </div>

                {s.settled ? (
                  <div className="mt-3 flex items-center gap-2.5 border-t border-line-rule pt-3">
                    <Icon name="place" size={17} className="shrink-0 text-faint" />
                    <div className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
                      {s.record}
                    </div>
                    <button
                      type="button"
                      onClick={() => session.undo(s.id)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-[13px] py-[9px] text-[12.5px] font-semibold text-ink-2 hover:bg-canvas"
                    >
                      <Icon name="undo" size={17} />
                      Undo
                    </button>
                  </div>
                ) : null}

                {s.blocked ? (
                  <div className="mt-3 flex items-center gap-2.5 rounded-[13px] bg-warning-tint px-[13px] py-3">
                    <Icon name="block" size={18} className="shrink-0 text-warning-text" />
                    <div className="text-[12.5px] font-medium text-warning-text">
                      {s.blockedText} — mark boarded at school first
                    </div>
                  </div>
                ) : null}

                {s.pending ? (
                  <div className="mt-3.5 grid grid-cols-[1.6fr_1fr] gap-2.5">
                    <button
                      type="button"
                      onClick={() => session.mark(s.id, phase === "drop" ? "dropped" : "boarded")}
                      className="rounded-[14px] bg-success py-[15px] text-center text-[15px] font-bold text-white hover:bg-success-text"
                    >
                      {s.primaryLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => session.mark(s.id, "absent")}
                      className="rounded-[14px] border border-line py-[15px] text-center text-[15px] font-semibold text-ink-2 hover:bg-canvas"
                    >
                      Absent
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 overflow-hidden rounded-[20px] border border-line">
            <div className="relative h-[230px] bg-[#e8eaed]">
              <LiveMap mode="mini" focus="12" selected="12" />
            </div>
            <div className="px-[18px] py-4">
              <div className="text-[11px] font-semibold tracking-[0.05em] text-faint">
                NEXT STOP
              </div>
              <div className="mt-1 text-[22px] font-semibold tracking-[-0.025em]">{nextStop}</div>
              <div className="mt-[3px] text-[13px] text-muted">1.4 km · arriving in 7 minutes</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <Tile label="SPEED" value="32" foot="km/h · limit 50" />
            <Tile
              label="ONBOARD"
              value={String(session.boardedTotal - session.droppedTotal)}
              foot="students"
            />
            <Tile label="ON TIME" value="+1" foot="minute early" color="#1e8e3e" />
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-[18px] border border-line px-[18px] py-4">
            <span className="grid size-[38px] shrink-0 place-items-center rounded-full bg-neutral-tint text-sm font-semibold text-muted">
              {CREW.driver.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{CREW.driver.name}</div>
              <div className="text-xs text-faint">Driver · Bus 12</div>
            </div>
            <a
              href={`tel:${CREW.driver.phone.replace(/\s/g, "")}`}
              aria-label={`Call ${CREW.driver.name}`}
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-success-tint text-success-text"
            >
              <Icon name="call" size={20} />
            </a>
          </div>
        </>
      )}

      {sos ? (
        <div
          role="alert"
          className="mt-3 rounded-[18px] border border-critical-line bg-critical-tint px-[18px] py-4"
        >
          <div className="flex items-center gap-2.5">
            <Icon name="emergency_home" size={21} className="text-critical-text" />
            <div className="text-sm font-bold text-critical-text">Emergency alert sent</div>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.45] text-critical-text">
            School office, transport manager and parents of onboard students notified. Live location
            and cabin camera shared.
          </p>
          <button
            type="button"
            onClick={() => session.setSos(false)}
            className="mt-3 w-full rounded-xl bg-white py-[11px] text-[13px] font-semibold text-critical-text"
          >
            Cancel alert
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Tile({
  label,
  value,
  foot,
  color,
}: {
  label: string;
  value: string;
  foot: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-line px-[15px] py-3.5">
      <div className="text-[11px] text-faint">{label}</div>
      <Mono className="block text-[22px] font-semibold tracking-[-0.02em]" style={{ color }}>
        {value}
      </Mono>
      <div className="text-[10.5px] text-faint">{foot}</div>
    </div>
  );
}
