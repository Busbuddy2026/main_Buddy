"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/transport/ui";
import { ROLE_LABEL, useAdmin } from "@/lib/transport/admin-store";
import { SCHOOL } from "@/lib/transport/seed";

/** Admin avatar menu (SCREENS.md §A0) — identity, role and sign out. */
export function AccountMenu() {
  const { user, signOut } = useAdmin();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="focus-ring flex items-center gap-1.5 rounded-pill border border-line bg-surface py-1 pl-1 pr-2 hover:bg-canvas"
      >
        <span className="grid size-7 place-items-center rounded-full bg-primary-tint text-[11.5px] font-semibold text-primary">
          {user.initials}
        </span>
        <Icon name={open ? "expand_less" : "expand_more"} size={16} className="text-faint" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-[248px] overflow-hidden rounded-control border border-line bg-surface"
          style={{ boxShadow: "var(--shadow-dropdown)" }}
        >
          <div className="flex items-center gap-2.5 border-b border-line-soft px-3.5 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-tint text-[13px] font-semibold text-primary">
              {user.initials}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">{user.name}</div>
              <div className="truncate text-[11.5px] text-faint">{user.email}</div>
            </div>
          </div>

          <div className="border-b border-line-soft px-3.5 py-2.5">
            <div className="text-[10px] font-semibold tracking-[0.05em] text-faint">ROLE</div>
            <div className="mt-0.5 text-[12.5px] font-medium">{ROLE_LABEL[user.role]}</div>
            <div className="mt-0.5 text-[11px] text-faint">{SCHOOL.name}</div>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-[13px] font-medium text-critical-text hover:bg-critical-tint"
          >
            <Icon name="logout" size={18} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
