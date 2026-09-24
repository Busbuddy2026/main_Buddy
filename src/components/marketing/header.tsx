"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ButtonLink } from "@/components/marketing/ui";

const NAV = [
  { href: "/product", label: "Product & services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
] as const;

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-[11px]">
      <span className="grid size-7 place-items-center rounded-[9px] border border-[#2a2e31]">
        <span className="block h-[9px] w-[13px] rounded-[2px] border-[1.5px] border-bb-text" />
      </span>
      <span className="text-[15.5px] font-extrabold tracking-[-0.01em]">Bus Buddy</span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-[200] border-b border-bb-line bg-[rgba(8,9,10,0.72)] backdrop-blur-[16px]">
      <div className="mx-auto flex min-h-[68px] w-full max-w-[1280px] flex-wrap items-center gap-[18px] px-[26px] py-3">
        <Wordmark />

        <nav aria-label="Primary" className="ml-3.5 hidden items-center gap-0.5 min-[720px]:flex">
          {NAV.map((item) => {
            const on = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={on ? "page" : undefined}
                className="relative px-[13px] py-2 text-[13px] font-normal text-bb-muted hover:text-bb-text"
              >
                {item.label}
                {on ? (
                  <span className="absolute inset-x-[13px] bottom-0 h-px bg-bb-text" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <ButtonLink href="/contact" size="header">
            Book a demo
          </ButtonLink>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="bb-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid size-10 place-items-center rounded-full border border-bb-edge-2 text-bb-text hover:border-bb-hover-2 min-[720px]:hidden"
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6">
              {open ? (
                <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
              ) : (
                <path d="M3.5 7h17M3.5 12h17M3.5 17h17" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div
        id="bb-menu"
        hidden={!open}
        className="border-t border-bb-line bg-bb-bg min-[720px]:hidden"
      >
        <nav aria-label="Primary" className="mx-auto flex max-w-[1280px] flex-col px-[26px] py-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              // Closed here rather than on a route effect: an open menu would
              // otherwise cover the page it just navigated to.
              onClick={() => setOpen(false)}
              className="border-b border-bb-line py-3.5 text-[14px] text-bb-muted last:border-b-0 hover:text-bb-text aria-[current=page]:text-bb-text"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
