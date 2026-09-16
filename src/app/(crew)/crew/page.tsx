"use client";

import Link from "next/link";
import { Icon, Mono } from "@/components/transport/ui";
import { CREW, CREW_STUDENTS, studentsAt } from "@/lib/transport/crew";
import { useCrew } from "@/lib/transport/crew-store";
import { pad } from "@/lib/transport/tone";

/** C2 — today's bus, trip switch and the stop plan. */
export default function CrewHomePage() {
  const { trip, stops, setTrip } = useCrew();
  const evening = trip === "evening";

  return (
    <div className="px-5 pb-6 pt-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="text-[12.5px] text-faint">{CREW.name} · Bus crew</div>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-[-0.025em]">Today&apos;s bus</h1>
        </div>
        <Link
          href="/crew/profile"
          aria-label="Profile"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-white"
        >
          {CREW.initials}
        </Link>
      </div>

      <div className="mt-[18px] rounded-[20px] border border-line p-[22px] text-center">
        <Mono className="block text-[44px] font-semibold tracking-[-0.04em]">BUS 12</Mono>
        <Mono className="mt-0.5 block text-[13px] text-faint">{CREW.reg} · checks passed</Mono>
        <div className="mt-2.5 text-sm text-muted">
          {evening ? "Evening trip · School → Kondapur" : "Morning trip · Kondapur → School"}
        </div>

        <div className="mx-auto mt-4 flex w-fit gap-[5px] rounded-[11px] bg-neutral-tint p-1">
          {(["morning", "evening"] as const).map((t) => {
            const on = trip === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTrip(t)}
                aria-pressed={on}
                className="rounded-lg px-[18px] py-2 text-[12.5px] font-semibold capitalize"
                style={{ background: on ? "#16181b" : "transparent", color: on ? "#fff" : "#5f6672" }}
              >
                {t}
              </button>
            );
          })}
        </div>

        <div className="mt-[22px] grid grid-cols-2 gap-3.5 border-t border-line-rule pt-5 text-left">
          <div>
            <div className="text-[11px] tracking-[0.04em] text-faint">
              {evening ? "STUDENTS TO BOARD" : "STUDENTS EXPECTED"}
            </div>
            <Mono className="text-[26px] font-semibold tracking-[-0.02em]">
              {CREW_STUDENTS.length}
            </Mono>
          </div>
          <div>
            <div className="text-[11px] tracking-[0.04em] text-faint">STOPS</div>
            <Mono className="text-[26px] font-semibold tracking-[-0.02em]">{stops.length}</Mono>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[18px] border border-line">
        <div className="px-[18px] pb-1 pt-3.5 text-[13px] font-semibold">
          {evening ? "Board at school, then drop" : "Pickup sequence"}
        </div>
        <div className="px-[18px] pb-4 pt-2">
          {stops.map((s, i) => (
            <div key={s.key} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3">
              <div className="flex flex-col items-center">
                <Mono className="grid size-[26px] place-items-center rounded-full border-[1.5px] border-line text-[10.5px] font-semibold text-muted">
                  {pad(i + 1)}
                </Mono>
                {i < stops.length - 1 ? <div className="h-6 w-[1.5px] bg-line-soft" /> : null}
              </div>
              <div className="pt-1">
                <div className="text-[13.5px] font-medium">{s.name}</div>
                <div className="text-[11.5px] text-faint">
                  {s.boarding
                    ? `${CREW_STUDENTS.length} to board`
                    : `${studentsAt(s).length} to ${evening ? "drop" : "board"}`}
                </div>
              </div>
              <Mono className="pt-[5px] text-xs text-muted">{s.time}</Mono>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-[18px] border border-line px-[18px] py-4">
        <div className="mb-3 text-[13px] font-semibold">Driver</div>
        <div className="flex items-center gap-3">
          <span className="grid size-[38px] shrink-0 place-items-center rounded-full bg-neutral-tint text-sm font-semibold text-muted">
            {CREW.driver.initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{CREW.driver.name}</div>
            <Mono className="block text-xs text-faint">{CREW.driver.phone}</Mono>
          </div>
          <a
            href={`tel:${CREW.driver.phone.replace(/\s/g, "")}`}
            aria-label={`Call ${CREW.driver.name}`}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-success-tint text-success-text"
          >
            <Icon name="call" size={20} />
          </a>
        </div>
      </div>

      {/* Absence requests reach the roster from the parent app (README §11 step 6). */}
      <div className="mt-4 flex items-start gap-[11px] rounded-2xl bg-canvas px-4 py-3.5">
        <Icon name="event_busy" size={19} className="shrink-0 text-faint" />
        <div>
          <div className="text-[12.5px] font-semibold">Rahul Reddy is not travelling today</div>
          <div className="mt-0.5 text-xs text-muted">
            Parent marked transport absence for both trips.
          </div>
        </div>
      </div>
    </div>
  );
}
