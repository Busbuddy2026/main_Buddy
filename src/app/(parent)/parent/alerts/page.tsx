"use client";

import { useEffect, useState } from "react";
import { Icon, Mono } from "@/components/transport/ui";
import { api } from "@/lib/api/client";
import { useApi } from "@/lib/api/use-api";
import { usePoll } from "@/lib/api/use-poll";
import { NOTIFICATION_FILTERS, type NotificationFilter } from "@/lib/transport/parent";
import type { NotificationView } from "@/server/services/parent";

const KIND: Record<NotificationView["type"], Exclude<NotificationFilter, "All">> = {
  attendance: "Attendance",
  transport: "Transport",
  alert: "Alerts",
};

const LOOK: Record<NotificationView["type"], { icon: string; bg: string; fg: string }> = {
  attendance: { icon: "how_to_reg", bg: "#e6f4ea", fg: "#186c33" },
  transport: { icon: "directions_bus", bg: "#e8f0fe", fg: "#1558b8" },
  alert: { icon: "schedule", bg: "#fef7e0", fg: "#8f5b00" },
};

/** B4 — notification feed, newest first. Opening it marks everything read. */
export default function ParentAlertsPage() {
  const [filter, setFilter] = useState<NotificationFilter>("All");
  const feed = useApi<{ items: NotificationView[]; unread: number }>("/api/parent/notifications");
  usePoll(feed.reload, 30_000);

  const unread = feed.data?.unread ?? 0;
  useEffect(() => {
    if (unread > 0) void api.post("/api/parent/notifications/read").catch(() => undefined);
  }, [unread]);

  const all = (feed.data?.items ?? []).map((n) => ({ ...n, ...LOOK[n.type], kind: KIND[n.type] }));
  const rows = filter === "All" ? all : all.filter((n) => n.kind === filter);

  return (
    <div className="px-5 pb-5 pt-3.5">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Notifications</h1>

      <div className="mt-3.5 flex flex-wrap gap-[7px]">
        {NOTIFICATION_FILTERS.map((f) => {
          const on = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={on}
              className="rounded-pill border px-[13px] py-[7px] text-[12.5px] font-medium"
              style={{
                background: on ? "#16181b" : "#fff",
                color: on ? "#fff" : "#3c4149",
                borderColor: on ? "#16181b" : "#e4e7eb",
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      <div className="mt-[18px] flex flex-col">
        {rows.length ? (
          rows.map((n) => (
            <div key={n.id} className="flex gap-[13px] border-b border-line-rule py-[15px]">
              <span
                className="grid size-[34px] shrink-0 place-items-center rounded-[11px]"
                style={{ background: n.bg, color: n.fg }}
              >
                <Icon name={n.icon} size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13.5px] font-semibold tracking-[-0.005em]">
                  {n.unread ? <span className="size-[7px] shrink-0 rounded-full bg-primary" /> : null}
                  {n.title}
                </div>
                <p className="mt-0.5 text-xs leading-[1.45] text-muted text-pretty">{n.body}</p>
              </div>
              <Mono className="shrink-0 text-[11px] text-faint">{n.time}</Mono>
            </div>
          ))
        ) : (
          <div className="rounded-[18px] border border-dashed border-line px-4 py-12 text-center">
            <div className="text-[13px] font-semibold">{feed.loading && !feed.data ? "Loading…" : "Nothing here yet"}</div>
            <div className="mt-1 text-xs text-faint">
              No {filter.toLowerCase()} notifications in the last week.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
