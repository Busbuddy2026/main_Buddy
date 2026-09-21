"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PhoneBody, PhoneFooter, PhoneFrame, PhoneSplash } from "@/components/mobile/shell";
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
  const { authed, hydrated } = useParent();
  const pathname = usePathname();
  // Track is a full-bleed map, so it keeps its own chrome.
  const fullBleed = pathname === "/parent/track";

  if (!hydrated) {
    return (
      <PhoneFrame>
        <PhoneSplash />
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <PhoneBody className={authed && !fullBleed ? "pb-2" : undefined}>
        {authed ? children : <ParentLogin />}
      </PhoneBody>

      {authed ? (
        <PhoneFooter>
          <nav
            aria-label="Parent app"
            className="grid grid-cols-5 gap-0.5 px-1.5 pt-1.5 sm:px-2"
          >
            {PARENT_TABS.map((t) => {
              const on = pathname === t.href;
              return (
                <Link
                  key={t.id}
                  href={t.href}
                  aria-current={on ? "page" : undefined}
                  // 48px minimum target — README §8.
                  className="flex min-h-12 flex-col items-center justify-center rounded-xl px-0.5 py-1.5"
                  style={{ color: on ? "#1a73e8" : "#8b919b" }}
                >
                  <Icon name={t.icon} size={22} />
                  <span
                    className="mt-1 block max-w-full truncate text-[10px] leading-none"
                    style={{ fontWeight: on ? 600 : 500 }}
                  >
                    {t.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </PhoneFooter>
      ) : null}
    </PhoneFrame>
  );
}
