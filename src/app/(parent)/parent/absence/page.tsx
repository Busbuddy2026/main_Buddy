"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/transport/ui";
import { useParent } from "@/lib/transport/parent-store";

type Choice = "using" | "skipping";

/**
 * B6 — report a transport absence. Submits to the school office and to the
 * attendant's roster for that trip (POST /api/absences); cancellable until the
 * trip starts.
 */
export default function ParentAbsencePage() {
  const { child, childFirst } = useParent();
  const router = useRouter();

  const [morning, setMorning] = useState<Choice>("skipping");
  const [evening, setEvening] = useState<Choice>("using");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const trips = [
    {
      id: "morning" as const,
      label: "Morning trip",
      sub: `Pickup 6:38 AM · ${child.stop}`,
      value: morning,
      set: setMorning,
    },
    {
      id: "evening" as const,
      label: "Evening trip",
      sub: `Drop 4:32 PM · ${child.stop}`,
      value: evening,
      set: setEvening,
    },
  ];

  if (submitted) {
    return (
      <div className="px-5 pb-5 pt-3.5">
        <div className="flex items-center gap-3">
          <Link
            href="/parent"
            aria-label="Back"
            className="grid size-9 place-items-center rounded-xl border border-line"
          >
            <Icon name="arrow_back" size={19} />
          </Link>
          <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Absence recorded</h1>
        </div>

        <div className="mt-6 rounded-[18px] border border-[#cfe3d6] bg-success-tint p-5 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-success-text">
            <Icon name="check" size={26} />
          </span>
          <div className="mt-3 text-[15px] font-semibold text-success-text">
            The school and Suresh Kumar have been told
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-success-text text-pretty">
            {childFirst} is marked as not travelling on Wednesday, 9 September. You can cancel this
            any time before the trip starts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-4 w-full rounded-[14px] border border-line py-[15px] text-sm font-semibold hover:bg-[#fafbfc]"
        >
          Change this
        </button>
        <button
          type="button"
          onClick={() => router.push("/parent")}
          className="mt-2.5 w-full rounded-[14px] bg-primary py-[15px] text-sm font-semibold text-white hover:bg-primary-hover"
        >
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pb-5 pt-3.5">
      <div className="flex items-center gap-3">
        <Link
          href="/parent"
          aria-label="Back"
          className="grid size-9 place-items-center rounded-xl border border-line"
        >
          <Icon name="arrow_back" size={19} />
        </Link>
        <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Transport absence</h1>
      </div>

      <p className="mt-3 text-[13px] leading-[1.5] text-muted text-pretty">
        Let the school and Bus 12&apos;s attendant know that {childFirst} will not use transport.
      </p>

      <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-[15px]">
        <div>
          <div className="text-[10.5px] text-faint">DATE</div>
          <div className="text-sm font-semibold">Wednesday, 9 September</div>
        </div>
        <Icon name="calendar_today" size={20} className="text-muted" />
      </div>

      <div className="mt-3.5 flex flex-col gap-3">
        {trips.map((t) => (
          <div key={t.id} className="rounded-2xl border border-line px-4 py-[15px]">
            <div className="text-[13.5px] font-semibold">{t.label}</div>
            <div className="mt-0.5 text-[11.5px] text-faint">{t.sub}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={t.value === "using"}
                onClick={() => t.set("using")}
                className="rounded-xl border py-[11px] text-center text-[12.5px] font-semibold"
                style={
                  t.value === "using"
                    ? { background: "#e8f0fe", color: "#1558b8", borderColor: "#1a73e8" }
                    : { background: "#fff", color: "#3c4149", borderColor: "#e4e7eb" }
                }
              >
                Using bus
              </button>
              <button
                type="button"
                aria-pressed={t.value === "skipping"}
                onClick={() => t.set("skipping")}
                className="rounded-xl border py-[11px] text-center text-[12.5px] font-semibold"
                style={
                  t.value === "skipping"
                    ? { background: "#fce8e6", color: "#c5221f", borderColor: "#f7c8c4" }
                    : { background: "#fff", color: "#3c4149", borderColor: "#e4e7eb" }
                }
              >
                Not using
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3.5 rounded-2xl border border-line px-4 py-[15px]">
        <label htmlFor="absence-reason" className="text-[10.5px] text-faint">
          REASON (OPTIONAL)
        </label>
        <input
          id="absence-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Going with family"
          className="mt-1.5 w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-disabled"
        />
      </div>

      <button
        type="button"
        disabled={morning === "using" && evening === "using"}
        onClick={() => setSubmitted(true)}
        className="mt-[18px] w-full rounded-[14px] py-[15px] text-center text-sm font-semibold disabled:cursor-not-allowed"
        style={
          morning === "using" && evening === "using"
            ? { background: "#f1f3f4", color: "#8b919b" }
            : { background: "#1a73e8", color: "#fff" }
        }
      >
        Submit
      </button>
      <p className="mt-3 text-center text-[11.5px] text-faint">
        {morning === "using" && evening === "using"
          ? "Mark at least one trip as not using to submit."
          : "Visible immediately to the school office and Suresh Kumar."}
      </p>
    </div>
  );
}
