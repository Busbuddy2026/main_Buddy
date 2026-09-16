"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmSheet } from "@/components/mobile/shell";
import { Icon, Mono } from "@/components/transport/ui";
import { CREW, CREW_RECORDS, CREW_STUDENTS, CREW_WEEK_STATS } from "@/lib/transport/crew";
import { useCrew } from "@/lib/transport/crew-store";

/** C5 — crew identity, today's assignment, records and sign out. */
export default function CrewProfilePage() {
  const { crewId, trip, stops, signOut } = useCrew();
  const [confirming, setConfirming] = useState(false);

  const assignment = [
    { label: "BUS", value: `${CREW.bus} · ${CREW.reg}` },
    { label: "ROUTE", value: "Kondapur ↔ School" },
    { label: "SHIFT", value: "Morning + Evening" },
    { label: "STUDENTS", value: `${CREW_STUDENTS.length} assigned` },
  ];

  return (
    <>
      <div className="px-5 pb-6 pt-4">
        <div className="flex items-center gap-3">
          <Link
            href="/crew"
            aria-label="Back"
            className="grid size-9 place-items-center rounded-xl border border-line"
          >
            <Icon name="arrow_back" size={19} />
          </Link>
          <h1 className="text-xl font-semibold tracking-[-0.02em]">Profile</h1>
        </div>

        <div className="mt-[18px] flex items-center gap-3.5 rounded-[20px] border border-line p-[18px]">
          <span className="grid size-[52px] shrink-0 place-items-center rounded-full bg-ink text-lg font-semibold text-white">
            {CREW.initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-semibold tracking-[-0.015em]">
              {CREW.name}
            </div>
            <Mono className="mt-0.5 block truncate text-[12.5px] text-faint">
              {crewId || CREW.crewId} · {CREW.phone}
            </Mono>
            <span className="mt-[7px] inline-block rounded-pill bg-success-tint px-[9px] py-[3px] text-[11px] font-semibold text-success-text">
              {CREW.role}
            </span>
          </div>
        </div>

        <SectionLabel>TODAY&apos;S ASSIGNMENT</SectionLabel>
        <div className="mt-2.5 rounded-[18px] border border-line px-[18px] py-4">
          <div className="grid grid-cols-2 gap-3.5">
            {assignment.map((a) => (
              <div key={a.label} className="min-w-0">
                <div className="text-[10.5px] tracking-[0.04em] text-faint">{a.label}</div>
                <div className="mt-0.5 text-[13.5px] font-semibold">{a.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3 border-t border-line-rule pt-[15px]">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-tint text-[13px] font-semibold text-muted">
              {CREW.driver.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold">{CREW.driver.name}</div>
              <div className="truncate text-[11.5px] text-faint">Driver · {CREW.driver.phone}</div>
            </div>
            <a
              href={`tel:${CREW.driver.phone.replace(/\s/g, "")}`}
              aria-label={`Call ${CREW.driver.name}`}
              className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-success-tint text-success-text"
            >
              <Icon name="call" size={18} />
            </a>
          </div>
        </div>

        <SectionLabel>RECORDS</SectionLabel>
        <div className="mt-2.5 overflow-hidden rounded-[18px] border border-line">
          {CREW_RECORDS.map((r) => (
            <div key={r.label} className="flex items-center gap-3 border-b border-line-rule px-4 py-3.5">
              <Icon name={r.icon} size={19} className="shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{r.label}</div>
                <div className="mt-px truncate text-[11.5px] text-faint">{r.sub}</div>
              </div>
              <span
                className="shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: r.bg, color: r.fg }}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[18px] border border-line px-[18px] py-4">
          <div className="text-[13px] font-semibold">This week</div>
          <div className="mt-3.5 grid grid-cols-3 gap-3">
            {CREW_WEEK_STATS.map((w) => (
              <div key={w.label}>
                <Mono className="block text-2xl font-semibold tracking-[-0.02em]">{w.value}</Mono>
                <div className="mt-0.5 text-[11px] text-faint">{w.label}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-[18px] w-full rounded-[15px] border border-critical-line py-[15px] text-center text-sm font-semibold text-critical-text hover:bg-critical-tint"
        >
          Log out
        </button>
        <p className="mt-2.5 text-center text-[11px] leading-[1.5] text-disabled">
          Logging out during an active trip is blocked until the trip is completed.
        </p>
        <span className="sr-only">
          {trip} trip · {stops.length} stops
        </span>
      </div>

      {confirming ? (
        <ConfirmSheet
          title="Log out of the crew app?"
          body="Unsynced marks are uploaded before you are signed out. You will need your crew ID and PIN to sign in again."
          confirmLabel="Log out"
          cancelLabel="Stay signed in"
          onConfirm={signOut}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 text-[11px] font-semibold tracking-[0.06em] text-faint">{children}</div>
  );
}
