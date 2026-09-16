"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { TITLES, pageIdFor } from "@/lib/transport/nav";
import { Icon } from "./ui";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [title, subtitle] = TITLES[pageIdFor(pathname)];

  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-4 border-b border-line bg-[rgba(255,255,255,0.86)] px-7 backdrop-blur-[10px]">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-[-0.015em]">{title}</h1>
        <p className="truncate text-[11.5px] text-faint">{subtitle}</p>
      </div>

      <div className="hidden w-[250px] shrink-0 items-center gap-2 rounded-[9px] border border-line bg-surface px-3 py-[7px] focus-within:border-primary md:flex">
        <Icon name="search" size={18} className="text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            router.push(`/students?q=${encodeURIComponent(q)}`);
          }}
          placeholder="Search buses, students…"
          aria-label="Search buses and students"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-disabled"
        />
      </div>

      <div className="hidden shrink-0 items-center gap-1.5 rounded-pill bg-success-tint px-[11px] py-1.5 text-xs font-medium text-success sm:flex">
        <span className="size-1.5 rounded-full bg-success" />
        Live
      </div>

      <button
        type="button"
        aria-label="Open incidents"
        onClick={() => router.push("/incidents")}
        className="focus-ring relative grid size-9 shrink-0 place-items-center rounded-[9px] border border-line hover:bg-canvas"
      >
        <Icon name="notifications" size={19} className="text-muted" />
        <span className="absolute right-[7px] top-[6px] size-[7px] rounded-full border-[1.5px] border-white bg-critical" />
      </button>
    </header>
  );
}
