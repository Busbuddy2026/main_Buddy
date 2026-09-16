"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GROUP_OF, NAV, pageIdFor } from "@/lib/transport/nav";
import { SCHOOL } from "@/lib/transport/seed";
import { Icon, Mono } from "./ui";

export function Sidebar() {
  const pathname = usePathname();
  const page = pageIdFor(pathname);
  const activeGroup = GROUP_OF[page];

  return (
    <aside className="sticky top-0 box-border hidden h-screen w-[248px] shrink-0 overflow-auto border-r border-line bg-surface px-3.5 py-[18px] lg:block">
      <Link href="/" className="flex items-center gap-2.5 px-2 pb-5 pt-0.5">
        <Image
          src="/school-logo.png"
          alt=""
          width={32}
          height={32}
          className="size-8 shrink-0 rounded-full object-cover"
        />
        <span className="leading-[1.2]">
          <span className="block text-[13.5px] font-semibold tracking-[-0.01em] text-ink">
            {SCHOOL.name}
          </span>
          <span className="block text-[11px] text-faint">{SCHOOL.product}</span>
        </span>
      </Link>

      <nav>
        {NAV.map((group) => {
          const on = group.id === activeGroup;
          const leaf = !group.kids;
          return (
            <div key={group.id} className="mb-px">
              <Link
                href={group.kids ? group.kids[0].href : group.href}
                className="flex items-center gap-[11px] rounded-[9px] px-[9px] py-2 text-[13.5px] tracking-[-0.005em] hover:bg-neutral-tint"
                style={{
                  background: on && leaf ? "#e8f0fe" : "transparent",
                  color: on ? "#1a73e8" : "#3c4149",
                  fontWeight: on ? 600 : 500,
                }}
              >
                <Icon name={group.icon} size={20} />
                <span className="min-w-0 flex-1">{group.label}</span>
                {group.soon ? (
                  <span className="rounded-[5px] bg-neutral-tint px-[5px] py-[3px] text-[9px] font-semibold tracking-[0.04em] text-faint">
                    SOON
                  </span>
                ) : null}
                {group.count ? (
                  <Mono className="rounded-pill bg-critical-tint px-1.5 py-0.5 text-[10.5px] font-semibold text-critical">
                    {group.count}
                  </Mono>
                ) : null}
              </Link>

              {on && group.kids ? (
                <div className="flex flex-col gap-px py-0.5 pb-1.5 pl-5">
                  {group.kids.map((k) => {
                    const current = page === k.id;
                    return (
                      <Link
                        key={k.id}
                        href={k.href}
                        className="rounded-[7px] px-2.5 py-1.5 text-[13px] hover:bg-canvas"
                        style={{
                          borderLeft: `2px solid ${current ? "#1a73e8" : "#e4e7eb"}`,
                          color: current ? "#1a73e8" : "#5f6672",
                          fontWeight: current ? 600 : 400,
                        }}
                      >
                        {k.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="mt-[22px] flex items-center gap-2.5 border-t border-line-soft pt-3.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-tint text-xs font-semibold text-primary">
          {SCHOOL.userInitials}
        </span>
        <span className="min-w-0 leading-[1.25]">
          <span className="block truncate text-[12.5px] font-medium text-ink">{SCHOOL.user}</span>
          <span className="block text-[11px] text-faint">{SCHOOL.userRole}</span>
        </span>
      </div>
    </aside>
  );
}
