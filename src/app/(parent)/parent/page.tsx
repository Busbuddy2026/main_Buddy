"use client";

import Link from "next/link";
import { LiveMap } from "@/components/transport/live-map";
import { Icon, Mono } from "@/components/transport/ui";
import { CHILDREN, journeyFor } from "@/lib/transport/parent";
import { useParent } from "@/lib/transport/parent-store";

/** B2 — child switcher, live trip card, today's journey, absence shortcut. */
export default function ParentHomePage() {
  const { child, childFirst, selectChild } = useParent();
  const journey = journeyFor(childFirst);

  return (
    <div className="px-5 pb-5 pt-3.5">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[12.5px] text-faint">Good morning</div>
          <div className="text-[22px] font-semibold tracking-[-0.02em]">Arumugam</div>
        </div>
        <Link
          href="/parent/alerts"
          aria-label="Notifications"
          className="relative grid size-10 place-items-center rounded-[13px] border border-line"
        >
          <Icon name="notifications" size={20} className="text-ink-2" />
          <span className="absolute right-[9px] top-2 size-[7px] rounded-full border-[1.5px] border-white bg-critical" />
        </Link>
      </div>

      {CHILDREN.length > 1 ? (
        <div className="mt-4 flex gap-2">
          {CHILDREN.map((c) => {
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
          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-pill bg-primary-tint px-[11px] py-1.5 text-xs font-semibold text-primary-hover">
            <span className="size-[7px] rounded-full bg-primary" />
            On the way to school
          </span>
        </div>

        <div className="relative h-[210px] bg-[#e8eaed]">
          <LiveMap mode="mini" focus="12" selected="12" />
        </div>

        <div className="px-[18px] py-4">
          <div className="text-[12.5px] text-muted">Bus arriving at your stop in approximately</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <Mono className="text-[38px] font-semibold tracking-[-0.035em]">7</Mono>
            <span className="text-[15px] font-semibold text-muted">minutes</span>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-[13px] bg-canvas px-[13px] py-3">
            <Icon name="location_on" size={19} className="text-muted" />
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] text-faint">NEXT STOP</div>
              <div className="truncate text-[13px] font-semibold">{child.stop}</div>
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
          <div className="text-sm font-semibold">Morning trip</div>
          <div className="text-[11.5px] text-faint">Tue, 8 Sep</div>
        </div>
        {journey.map((t, i) => (
          <div key={t.title} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-3">
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
