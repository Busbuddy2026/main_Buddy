"use client";

import Link from "next/link";

import { useState } from "react";
import { Icon, Mono } from "@/components/transport/ui";
import { api, errorMessage } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { useParent } from "@/lib/transport/parent-store";
import { addDays, formatWeekday, localDate } from "@/lib/time";
import { useNavigate } from "@/components/transport/progress-bar";
import { Spinner } from "@/components/transport/skeleton";

type Choice = "using" | "skipping";

interface Notice {
  id: string;
  label: string;
  phase: "am" | "pm" | "both";
  reason: string | null;
}

const PHASE_LABEL = { am: "Morning trip", pm: "Evening trip", both: "Both trips" } as const;

/**
 * B6 — report a transport absence. Goes to the school office and onto the
 * attendant's roster for that trip (POST /api/parent/children/:id/absences);
 * cancellable until the trip starts.
 */
export default function ParentAbsencePage() {
  const { child, childFirst } = useParent();
  const navigate = useNavigate();
  const today = localDate();

  const [date, setDate] = useState(addDays(today, 1));
  const [morning, setMorning] = useState<Choice>("skipping");
  const [evening, setEvening] = useState<Choice>("using");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const notices = useApi<Notice[]>(child.id ? `/api/parent/children/${child.id}/absences` : null);
  const people = useApi<Array<{ name: string; role: string }>>(child.id ? `/api/parent/children/${child.id}/contacts` : null);
  const attendant = people.data?.find((p) => p.role.startsWith("Attendant"))?.name ?? "the bus attendant";

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/api/parent/children/${child.id}/absences`, {
        date,
        morning: morning === "skipping",
        evening: evening === "skipping",
        reason,
      });
      setSubmitted(true);
      void notices.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const [cancelling, setCancelling] = useState<string | null>(null);
  const cancel = async (id: string) => {
    if (cancelling) return;
    setCancelling(id);
    try {
      await api.delete(`/api/parent/absences/${id}`);
      await notices.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCancelling(null);
    }
  };

  const trips = [
    {
      id: "morning" as const,
      label: "Morning trip",
      sub: `Pickup · ${child.stop}`,
      value: morning,
      set: setMorning,
    },
    {
      id: "evening" as const,
      label: "Evening trip",
      sub: `Drop · ${child.stop}`,
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
            The school and {attendant} have been told
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-success-text text-pretty">
            {childFirst} is marked as not travelling on {formatWeekday(date).replace(" · ", ", ")}. You
            can cancel this any time before the trip starts.
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
          onClick={() => navigate("/parent")}
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
        Let the school and {child.bus.replace("BUS", "Bus")}&apos;s attendant know that {childFirst} will
        not use transport.
      </p>

      <label className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-[15px]">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] text-faint">DATE</div>
          <input
            type="date"
            value={date}
            min={today}
            max={addDays(today, 60)}
            onChange={(e) => setDate(e.target.value || today)}
            className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
          />
        </div>
        <Icon name="calendar_today" size={20} className="text-muted" />
      </label>

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

      {error ? (
        <div role="alert" className="mt-3.5 rounded-xl bg-critical-tint px-[13px] py-[11px] text-[12.5px] font-medium text-critical-text">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        disabled={(morning === "using" && evening === "using") || busy}
        onClick={() => void submit()}
        className="mt-[18px] w-full rounded-[14px] py-[15px] text-center text-sm font-semibold disabled:cursor-not-allowed"
        style={
          morning === "using" && evening === "using"
            ? { background: "#f1f3f4", color: "#8b919b" }
            : { background: "#1a73e8", color: "#fff" }
        }
      >
        {busy ? "Sending…" : "Submit"}
      </button>
      <p className="mt-3 text-center text-[11.5px] text-faint">
        {morning === "using" && evening === "using"
          ? "Mark at least one trip as not using to submit."
          : `Visible immediately to the school office and ${attendant}.`}
      </p>

      {notices.data?.length ? (
        <div className="mt-6">
          <div className="text-[11px] font-semibold tracking-[0.06em] text-faint">UPCOMING NOTICES</div>
          <div className="mt-2.5 flex flex-col gap-2.5">
            {notices.data.map((n) => (
              <div key={n.id} className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <Mono className="block text-[13px] font-semibold">{n.label}</Mono>
                  <div className="truncate text-[11.5px] text-faint">
                    {PHASE_LABEL[n.phase]}
                    {n.reason ? ` · ${n.reason}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void cancel(n.id)}
                  disabled={cancelling !== null}
                  aria-busy={cancelling === n.id || undefined}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[12px] font-semibold text-ink-2 disabled:opacity-60"
                >
                  {cancelling === n.id ? <Spinner size={12} /> : null}
                  {cancelling === n.id ? "Cancelling…" : "Cancel"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
