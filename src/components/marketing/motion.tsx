"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";

/*
 * Site-wide motion, mounted once in the marketing layout.
 *
 * One observer watches every `[data-reveal]` in the document, so the sections
 * themselves stay server components and ship no JavaScript of their own.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Whether the reader has asked for less motion.
 *
 * `useSyncExternalStore` rather than an effect: the value is read during
 * render, so a component can simply *be* in its settled state instead of
 * setting state on mount to get there.
 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

export function RevealWatcher() {
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const nodes = () => document.querySelectorAll<HTMLElement>("[data-reveal]");

    if (reduced) {
      nodes().forEach((n) => n.setAttribute("data-shown", "true"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-shown", "true");
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    nodes().forEach((n) => io.observe(n));

    // Anything still hidden after the page has settled is shown regardless —
    // an unobserved section is a blank screen, which is worse than no animation.
    const sweep = window.setTimeout(() => {
      nodes().forEach((n) => n.setAttribute("data-shown", "true"));
    }, 2500);

    return () => {
      io.disconnect();
      window.clearTimeout(sweep);
    };
  }, [pathname, reduced]);

  return null;
}

/** 26px difference-blended ring that trails the pointer. Fine pointers only. */
export function Cursor() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    if (!fine.matches) return;

    const onMove = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      el.style.opacity = "1";
      el.style.transform = `translate(${e.clientX - 13}px, ${e.clientY - 13}px)`;
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999] size-[26px] rounded-full border border-white opacity-0 mix-blend-difference max-[1024px]:hidden"
    />
  );
}
