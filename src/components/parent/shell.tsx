"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PhoneBody, PhoneFrame, StatusBar } from "@/components/mobile/shell";
import { ParentLogin } from "@/components/parent/login";
import { Icon } from "@/components/transport/ui";
import { PARENT_TABS } from "@/lib/transport/parent";
import { ParentSessionProvider, useParent } from "@/lib/transport/parent-store";

export function ParentShell({ children }: { children: ReactNode }) {
  return (
    <ParentSessionProvider>
      <Frame>{children}</Frame>
    </ParentSessionProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { authed } = useParent();
  const pathname = usePathname();
  // Track is a full-bleed map, so it keeps its own chrome.
  const fullBleed = pathname === "/parent/track";

  return (
    <PhoneFrame>
      <StatusBar clock="7:42" />
      <PhoneBody className={authed && !fullBleed ? "pb-2" : undefined}>
        {authed ? children : <ParentLogin />}
      </PhoneBody>

      {authed ? (
        <nav
          aria-label="Parent app"
          className="grid shrink-0 grid-cols-5 gap-0.5 border-t border-line-soft bg-surface px-2 pb-3.5 pt-2"
        >
          {PARENT_TABS.map((t) => {
            const on = pathname === t.href;
            return (
              <Link
                key={t.id}
                href={t.href}
                aria-current={on ? "page" : undefined}
                className="rounded-xl pb-[5px] pt-2 text-center"
                style={{ color: on ? "#1a73e8" : "#8b919b" }}
              >
                <Icon name={t.icon} size={22} />
                <span className="mt-1 block text-[10px]" style={{ fontWeight: on ? 600 : 500 }}>
                  {t.label}
                </span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </PhoneFrame>
  );
}
