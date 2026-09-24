"use client";

import { useState } from "react";
import { Card, Icon } from "@/components/transport/ui";

interface Rule {
  id: string;
  title: string;
  body: string;
  /** Face recognition is out of scope — the control is present but locked. */
  locked?: boolean;
}

const ATTENDANCE_RULES: Rule[] = [
  {
    id: "manual",
    title: "Manual marking by attendant",
    body: "Attendants mark each student boarded, absent or dropped from the bus app. This is the active method.",
  },
  {
    id: "face",
    title: "Face recognition attendance",
    body: "Automatically detect and verify student boarding using onboard cameras.",
    locked: true,
  },
  {
    id: "drop",
    title: "Require drop confirmation",
    body: "Evening trips cannot be completed until every onboard student is marked dropped.",
  },
];

const NOTIFICATION_TAGS = [
  "Bus started",
  "Bus approaching stop",
  "Child boarded",
  "Reached school",
  "Boarded return bus",
  "Dropped safely",
  "Bus delayed",
  "Emergency alert",
];

const CCTV_RULES: Array<[string, string]> = [
  ["Live view roles", "Principal, Transport Manager, Safety Officer"],
  ["Retention", "30 days"],
  ["Access log", "Enabled"],
];

export default function SettingsPage() {
  const [on, setOn] = useState<Record<string, boolean>>({ manual: true, face: false, drop: true });

  return (
    <div className="flex max-w-[860px] flex-col gap-[18px]">
      <Card className="px-[22px] py-5">
        <div className="mb-1 text-[13.5px] font-semibold">Attendance</div>
        <div className="mb-4 text-xs text-faint">How students are marked on and off the bus.</div>
        {ATTENDANCE_RULES.map((r) => (
          <div key={r.id} className="flex items-center gap-3.5 border-t border-line-rule py-3.5">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: r.locked ? "#5f6672" : "#16181b" }}
                >
                  {r.title}
                </span>
                {r.locked ? (
                  <span className="rounded-[5px] bg-neutral-tint px-1.5 py-[3px] text-[9.5px] font-semibold tracking-[0.05em] text-muted">
                    COMING SOON
                  </span>
                ) : null}
              </div>
              <p className="mt-[3px] text-xs leading-[1.5] text-faint text-pretty">{r.body}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on[r.id]}
              aria-label={r.title}
              disabled={r.locked}
              onClick={() => setOn((s) => ({ ...s, [r.id]: !s[r.id] }))}
              className={`relative h-[23px] w-10 shrink-0 rounded-pill transition-colors ${
                r.locked ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              style={{ background: on[r.id] && !r.locked ? "#1a73e8" : "#e4e7eb" }}
            >
              <span
                className="absolute top-[3px] size-[17px] rounded-full bg-white transition-all"
                style={{ left: on[r.id] && !r.locked ? "20px" : "3px" }}
              />
            </button>
          </div>
        ))}
      </Card>

      <Card className="px-[22px] py-5">
        <div className="mb-1 text-[13.5px] font-semibold">Parent notifications</div>
        <div className="mb-3.5 text-xs text-faint">
          Events pushed to the parent app automatically.
        </div>
        <div className="flex flex-wrap gap-2">
          {NOTIFICATION_TAGS.map((n) => (
            <span
              key={n}
              className="flex items-center gap-1.5 rounded-pill bg-primary-tint px-3 py-[7px] text-xs font-medium text-primary-hover"
            >
              <Icon name="check" size={15} />
              {n}
            </span>
          ))}
        </div>
      </Card>

      <Card className="px-[22px] py-5">
        <div className="mb-1 text-[13.5px] font-semibold">CCTV access</div>
        <div className="mb-3.5 text-xs text-faint">
          Live footage is limited to authorised school staff. Parents receive incident-linked clips
          only on request.
        </div>
        <div className="flex flex-col gap-[11px]">
          {CCTV_RULES.map(([label, value], i) => (
            <div key={label}>
              {i > 0 ? <div className="mb-[11px] h-px bg-line-rule" /> : null}
              <div className="flex justify-between gap-3">
                <span className="text-[12.5px] text-muted">{label}</span>
                <span className="text-right text-[12.5px] font-semibold">{value}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
