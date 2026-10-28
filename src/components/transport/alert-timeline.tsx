"use client";

import Link from "next/link";
import { Icon, Mono } from "@/components/transport/ui";
import { alertKind } from "@/lib/alert-kind";
import type { TrackerAlertRow, TripAlertKind } from "@/lib/api/types";
import { formatDay, formatTime, localDate } from "@/lib/time";

/**
 * Tracker alerts as a timeline: the time on the left, a rule, then what
 * happened. Each kind has its own highlight: overspeed amber, engine on
 * green, engine off grey, SOS / power cut / tamper red, low power brown;
 * anything else plain. Grouped by day, newest first.
 */

const STYLE: Record<TripAlertKind, { bg: string; border: string; rule: string; icon: string; iconColor: string; tag: string }> = {
  overspeed: { bg: "#fef7e0", border: "#f29900", rule: "#f29900", icon: "speed", iconColor: "#8f5b00", tag: "Overspeed" },
  engine_on: { bg: "#e6f4ea", border: "#1e8e3e", rule: "#1e8e3e", icon: "power_settings_new", iconColor: "#186c33", tag: "Engine on" },
  engine_off: { bg: "#f1f3f4", border: "#dadce0", rule: "#9aa0a6", icon: "power_off", iconColor: "#5f6672", tag: "Engine off" },
  emergency: { bg: "#fce8e6", border: "#d93025", rule: "#d93025", icon: "warning", iconColor: "#c5221f", tag: "Urgent" },
  power: { bg: "#fef7e0", border: "#8f5b00", rule: "#8f5b00", icon: "battery_alert", iconColor: "#8f5b00", tag: "Power" },
  other: { bg: "#ffffff", border: "#e4e7eb", rule: "#16181b", icon: "notifications", iconColor: "#5f6672", tag: "Alert" },
};

function dayHeading(iso: string): string {
  const day = localDate(new Date(iso));
  const today = localDate();
  if (day === today) return "Today";
  const y = new Date(`${today}T12:00:00+05:30`);
  y.setDate(y.getDate() - 1);
  if (day === localDate(y)) return "Yesterday";
  return formatDay(new Date(iso));
}

export function AlertTimeline({ items, compact = false }: { items: TrackerAlertRow[]; compact?: boolean }) {
  const groups: Array<{ heading: string; rows: TrackerAlertRow[] }> = [];
  for (const a of items) {
    const heading = dayHeading(a.at);
    const g = groups[groups.length - 1];
    if (g && g.heading === heading) g.rows.push(a);
    else groups.push({ heading, rows: [a] });
  }

  return (
    <div className={`flex flex-col ${compact ? "gap-3 p-3" : "gap-4"}`}>
      {groups.map((g) => (
        <section key={g.heading}>
          <div className="mb-2 px-1 text-[11px] font-semibold tracking-[0.04em] text-faint">{g.heading.toUpperCase()}</div>
          <ol className="flex flex-col gap-2">
            {g.rows.map((a) => {
              const kind = alertKind(a.type, `${a.title} ${a.description ?? ""}`);
              const s = STYLE[kind];
              return (
                <li
                  key={a.id}
                  className="flex items-stretch gap-3 rounded-[14px] border px-3.5 py-3"
                  style={{ background: s.bg, borderColor: s.border }}
                >
                  <Mono className={`shrink-0 pt-px text-[12px] font-medium text-ink-2 ${compact ? "w-[58px]" : "w-[66px]"}`}>{formatTime(new Date(a.at))}</Mono>
                  <span aria-hidden className="w-[1.5px] shrink-0 rounded-full" style={{ background: s.rule }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-ink">{kind === "engine_on" || kind === "engine_off" ? s.tag : a.label}</div>
                    {a.description ? <div className="mt-0.5 text-[12px] leading-[1.45] text-muted">{a.description}</div> : null}
                    {a.incident ? (
                      <Link href={`/admin/incidents/${a.incident.id}`} className="mt-1 inline-block font-mono text-[11.5px] font-semibold text-primary">
                        {a.incident.code ?? "Open incident"}
                      </Link>
                    ) : null}
                  </div>
                  <span className="grid size-7 shrink-0 place-items-center self-center rounded-full bg-white/70" title={s.tag}>
                    <Icon name={s.icon} size={17} style={{ color: s.iconColor }} />
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
