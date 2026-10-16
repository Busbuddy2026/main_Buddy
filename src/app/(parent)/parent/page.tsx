"use client";

import Link from "next/link";
import { LiveMap, oneBusMap } from "@/components/transport/live-map";
import { Icon, Mono } from "@/components/transport/ui";
import { useApi } from "@/lib/api/use-api";
import { usePoll } from "@/lib/api/use-poll";
import { greetingFor } from "@/lib/transport/parent";
import { useParent } from "@/lib/transport/parent-store";
import { TONE } from "@/lib/transport/tone";
import type { ChildToday } from "@/server/services/parent";

/** B2 — child switcher, live trip card, today's journey, absence shortcut. */
export default function ParentHomePage() {
  const { me, children: kids, child, childFirst, selectChild } = useParent();
  const today = useApi<ChildToday>(child.id ? `/api/parent/children/${child.id}/today` : null);
  const alerts = useApi<{ unread: number }>("/api/parent/notifications");
  usePoll(today.reload, 30_000);
  const journey = today.data?.journey ?? [];
  const tone = TONE[today.data?.status.kind ?? "offline"];
  const busNumber = today.data?.bus?.replace("Bus ", "") ?? "12";
  // Client-only render, so this cannot cause a hydration mismatch; the school
  // timezone inside `greetingFor` keeps it stable wherever the parent is.
  const greeting = greetingFor(new Date());

  return (
    <div className="px-5 pb-5 pt-3.5">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[12.5px] text-faint">{greeting}</div>
          <div className="truncate text-[22px] font-semibold tracking-[-0.02em]">
            {me?.firstName}
          </div>
        </div>
        <Link
          href="/parent/alerts"
          aria-label="Notifications"
          className="relative grid size-10 place-items-center rounded-[13px] border border-line"
        >
          <Icon name="notifications" size={20} className="text-ink-2" />
          {alerts.data?.unread ? (
            <span className="absolute right-[9px] top-2 size-[7px] rounded-full border-[1.5px] border-white bg-critical" />
          ) : null}
        </Link>
      </div>

      {kids.length > 1 ? (
        <div className="mt-4 flex gap-2">
          {kids.map((c) => {
            const on = c.first === childFirst;
            return (
              <button
                key={c.first}
                type="button"
                onClick={() => selectChild(c.first)}
                aria-pressed={on}
                className="flex items-center gap-[9px] rounded-pill border py-[7px] pl-[7px] pr-[13px]"
                style={{ borderColor: on ? "#1a73e8" : "#e4e7eb", background: on ? "#e8f0fe" : "#fff" }}
              >
                <span
                  className="grid size-[26px] place-items-center rounded-full text-[11.5px] font-semibold"
                  style={{
                    background: on ? "#1a73e8" : "#f1f3f4",
                    color: on ? "#fff" : "#5f6672",
                  }}
                >
                  {c.initial}
                </span>
                <span
                  className="text-[12.5px] font-semibold"
                  style={{ color: on ? "#1558b8" : "#3c4149" }}
                >
                  {c.first}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-[18px] overflow-hidden rounded-[20px] border border-line">
        <div className="px-[18px] pb-3.5 pt-4">
          <div className="text-[11px] font-semibold tracking-[0.06em] text-faint">
            YOUR CHILD&apos;S TRIP
          </div>
          <div className="mt-[7px] flex flex-wrap items-center gap-2.5">
            <span className="text-[19px] font-semibold tracking-[-0.02em]">{child.name}</span>
            <Mono className="text-xs font-semibold text-muted">{child.bus}</Mono>
          </div>
          <span
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-pill px-[11px] py-1.5 text-xs font-semibold"
            style={{ background: tone.bg, color: tone.fg }}
          >
            <span className="size-[7px] rounded-full" style={{ background: tone.dot }} />
            {today.data?.status.label ?? "Loading…"}
          </span>
        </div>

        <div className="relative h-[210px] bg-[#e8eaed]">
          <LiveMap mode="mini" {...oneBusMap(busNumber, today.data?.live ?? null)} />
          {!today.data?.live ? (
            <div className="absolute inset-x-3 bottom-3 z-[500] rounded-xl bg-surface/95 px-3 py-2 text-center text-[12px] text-muted">
              {today.data?.tracking === "no-gps"
                ? "This bus has no GPS tracker yet."
                : `The bus shows here while ${child.first}'s trip is running.`}
            </div>
          ) : null}
        </div>

        <div className="px-[18px] py-4">
          {today.data?.live?.toStop && !today.data.live.offline ? (
            <>
              <div className="text-[12.5px] text-muted">Bus reaches your stop in about</div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <Mono className="text-[38px] font-semibold tracking-[-0.035em]">{today.data.live.toStop.etaMin}</Mono>
                <span className="text-[15px] font-semibold text-muted">minutes</span>
                <Mono className="ml-auto text-[12.5px] text-faint">{today.data.live.toStop.distanceKm} km away</Mono>
              </div>
            </>
          ) : (
            <>
              <div className="text-[12.5px] text-muted">
                {today.data?.phase === "evening" ? "Scheduled drop at your stop" : "Scheduled pickup at your stop"}
              </div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <Mono className="text-[38px] font-semibold tracking-[-0.035em]">{today.data?.scheduled ?? "—"}</Mono>
              </div>
            </>
          )}
          <div className="mt-3 flex items-center gap-2 rounded-[13px] bg-canvas px-[13px] py-3">
            <Icon name="location_on" size={19} className="text-muted" />
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] text-faint">YOUR STOP</div>
              <div className="truncate text-[13px] font-semibold">{today.data?.stop ?? child.stop}</div>
            </div>
          </div>
          <Link
            href="/parent/track"
            className="mt-3.5 block rounded-[14px] bg-primary py-3.5 text-center text-sm font-semibold text-white hover:bg-primary-hover"
          >
            View live trip
          </Link>
        </div>
      </div>

      <div className="mt-5 rounded-[20px] border border-line p-[18px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">
            {today.data?.phase === "evening" ? "Evening trip" : "Morning trip"}
          </div>
          <div className="text-[11.5px] text-faint">{today.data?.dayLabel}</div>
        </div>
        {today.data && journey.length === 0 ? (
          <div className="text-[12.5px] text-faint">No bus runs today.</div>
        ) : null}
        {journey.map((t, i) => (
          <div key={`${t.title}-${i}`} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-3">
            <div className="flex flex-col items-center">
              <span
                className="grid size-5 place-items-center rounded-full text-white"
                style={{
                  background: t.state === "done" ? "#1e8e3e" : t.state === "now" ? "#1a73e8" : "#fff",
                  border: `2px solid ${t.state === "done" ? "#1e8e3e" : t.state === "now" ? "#1a73e8" : "#dadce0"}`,
                }}
              >
                {t.state === "done" ? <Icon name="check" size={13} /> : null}
              </span>
              {i < journey.length - 1 ? (
                <span
                  className="h-[26px] w-0.5"
                  style={{ background: t.state === "done" ? "#cfe3d6" : "#eceef1" }}
                />
              ) : null}
            </div>
            <div
              className="text-[13.5px]"
              style={{
                color: t.state === "todo" ? "#8b919b" : "#16181b",
                fontWeight: t.state === "now" ? 600 : 500,
              }}
            >
              {t.title}
            </div>
            <Mono className="pt-0.5 text-[11.5px] text-faint">{t.time}</Mono>
          </div>
        ))}
      </div>

      <Link
        href="/parent/absence"
        className="mt-4 flex items-center gap-[13px] rounded-[18px] border border-line px-[18px] py-4 hover:bg-[#fafbfc]"
      >
        <span className="grid size-[34px] shrink-0 place-items-center rounded-[11px] bg-canvas text-muted">
          <Icon name="event_busy" size={19} />
        </span>
        <span className="flex-1">
          <span className="block text-[13.5px] font-semibold text-ink">Not using transport?</span>
          <span className="mt-px block text-xs text-faint">
            Tell the school and the bus attendant.
          </span>
        </span>
        <Icon name="chevron_right" size={20} className="text-faint" />
      </Link>
    </div>
  );
}
