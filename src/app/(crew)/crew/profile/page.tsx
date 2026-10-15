"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmSheet } from "@/components/mobile/shell";
import { Icon, Mono } from "@/components/transport/ui";
import { RECORD_TONE } from "@/lib/transport/crew";
import { useCrew } from "@/lib/transport/crew-store";

/** C5 — crew identity, today's assignment, records and sign out. */
export default function CrewProfilePage() {
  const { me, plan, crewId, trip, stops, students, status, pendingSync, signOut, syncNow } = useCrew();
  const [confirming, setConfirming] = useState(false);
  const busy = status === "ACTIVE";

  const assignment = [
    { label: "BUS", value: plan?.bus ? `${plan.bus.label} · ${plan.bus.reg}` : "Not assigned" },
    { label: "ROUTE", value: plan?.bus?.route?.replace(" → ", " ↔ ") ?? "—" },
    { label: "SHIFT", value: "Morning + Evening" },
    { label: "STUDENTS", value: `${students.length} assigned` },
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
            {me?.initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-semibold tracking-[-0.015em]">
              {me?.name}
            </div>
            <Mono className="mt-0.5 block truncate text-[12.5px] text-faint">
              {crewId} · {me?.phone}
            </Mono>
            <span className="mt-[7px] inline-block rounded-pill bg-success-tint px-[9px] py-[3px] text-[11px] font-semibold text-success-text">
              {me?.role}
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
          {me?.partner ? (
            <div className="mt-4 flex items-center gap-3 border-t border-line-rule pt-[15px]">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-tint text-[13px] font-semibold text-muted">
                {me.partner.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{me.partner.name}</div>
                <div className="truncate text-[11.5px] text-faint">
                  {me.role.startsWith("Driver") ? "Attendant" : "Driver"} · {me.partner.phone}
                </div>
              </div>
              <a
                href={`tel:${me.partner.phone}`}
                aria-label={`Call ${me.partner.name}`}
                className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-success-tint text-success-text"
              >
                <Icon name="call" size={18} />
              </a>
            </div>
          ) : null}
        </div>

        <SectionLabel>RECORDS</SectionLabel>
        <div className="mt-2.5 overflow-hidden rounded-[18px] border border-line">
          {(plan?.records ?? []).map((r) => (
            <div key={r.label} className="flex items-center gap-3 border-b border-line-rule px-4 py-3.5">
              <Icon name={r.icon} size={19} className="shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{r.label}</div>
                <div className="mt-px truncate text-[11.5px] text-faint">{r.sub}</div>
              </div>
              <span
                className="shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: RECORD_TONE[r.tone].bg, color: RECORD_TONE[r.tone].fg }}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[18px] border border-line px-[18px] py-4">
          <div className="text-[13px] font-semibold">This week</div>
          <div className="mt-3.5 grid grid-cols-3 gap-3">
            {(plan?.week ?? []).map((w) => (
              <div key={w.label}>
                <Mono className="block text-2xl font-semibold tracking-[-0.02em]">{w.value}</Mono>
                <div className="mt-0.5 text-[11px] text-faint">{w.label}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirming(true)}
          className="mt-[18px] w-full rounded-[15px] border border-critical-line py-[15px] text-center text-sm font-semibold text-critical-text hover:bg-critical-tint disabled:cursor-not-allowed disabled:opacity-50"
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
          body={
            pendingSync
              ? `${pendingSync} marks have not reached the office yet. They stay on this phone and send the next time you sign in.`
              : "You will need your crew ID and PIN to sign in again."
          }
          confirmLabel="Log out"
          cancelLabel="Stay signed in"
          onConfirm={async () => {
            await syncNow();
            await signOut();
          }}
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
