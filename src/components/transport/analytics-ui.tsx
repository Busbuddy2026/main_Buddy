"use client";

import { useState } from "react";
import { Card, Mono, SecondaryButton } from "@/components/transport/ui";
import { api, errorMessage } from "@/lib/api/client";
import { addDays, localDate } from "@/lib/time";
import { useAdmin } from "@/lib/transport/admin-store";
import { useStore } from "@/lib/transport/store";

/** Shared bits of the analytics pages: the period picker, data coverage, number formats. */

export type Period = "today" | "7d" | "30d" | "month";

export const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
];

export function rangeFor(p: Period): { from: string; to: string } {
  const to = localDate();
  if (p === "today") return { from: to, to };
  if (p === "7d") return { from: addDays(to, -6), to };
  if (p === "30d") return { from: addDays(to, -29), to };
  return { from: `${to.slice(0, 8)}01`, to };
}

export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div role="tablist" className="inline-flex rounded-control border border-line bg-surface p-1">
      {PERIODS.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={value === p.id}
          onClick={() => onChange(p.id)}
          className={`rounded-chip px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${value === p.id ? "bg-ink text-white" : "text-muted hover:bg-canvas"}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/**
 * How many of the period's days have saved data, and (super admins) a button
 * to work out the last 30 days from the tracker.
 */
export function Coverage({ days, withData, onRebuilt }: { days: number; withData: number; onRebuilt: () => void }) {
  const { user } = useAdmin();
  const { dispatch } = useStore();
  const [busy, setBusy] = useState(false);
  const rebuild = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ rows: number; failed: number }>("/api/admin/analytics/rebuild", { days: 30 });
      dispatch({ type: "toast", message: `Worked out ${r.rows} bus-days from the tracker${r.failed ? ` (${r.failed} had no data)` : ""}.` });
      onRebuilt();
    } catch (error) {
      dispatch({ type: "toast", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };
  const short = withData < days;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px] text-faint">
      <span>
        Data for <Mono>{withData}</Mono> of <Mono>{days}</Mono> day{days === 1 ? "" : "s"}
        {short ? " · past days are saved each night" : ""}
      </span>
      {short && user.role === "SUPER_ADMIN" ? (
        <SecondaryButton icon="history" loading={busy} onClick={() => void rebuild()} className="!py-1 !text-[12px]">
          {busy ? "Reading the tracker…" : "Fill in the last 30 days"}
        </SecondaryButton>
      ) : null}
    </div>
  );
}

export const rupees = (n: number | null | undefined) => (n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`);
export const num = (n: number | null | undefined, digits = 0) =>
  n == null ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** "2 h 05 min", "41 min". */
export function hm(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

export function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="text-[11px] text-faint">{label}</div>
      <Mono className="mt-1 block text-[20px] font-semibold tracking-[-0.02em]" style={tone ? { color: tone } : undefined}>
        {value}
      </Mono>
      {note ? <div className="mt-0.5 text-[11px] text-faint">{note}</div> : null}
    </Card>
  );
}
