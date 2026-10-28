"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { busyRequests, onBusyChange } from "@/lib/api/client";

/**
 * A thin bar across the top of the screen while the app is working: a page
 * is loading after a click, or a request the user is waiting on is in flight
 * (saves, deletes, first loads; background refreshes stay quiet). It waits
 * 120 ms before showing, so quick actions do not flicker, creeps forward
 * while work continues, then completes and fades.
 */

// ── Navigation in progress ─────────────────────────────────────────────────

let navigating = false;
const navListeners = new Set<() => void>();
let navTimer: number | undefined;
function setNavigating(on: boolean) {
  if (navigating === on) return;
  navigating = on;
  window.clearTimeout(navTimer);
  // Never spin for ever if a navigation is cancelled or fails quietly.
  if (on) navTimer = window.setTimeout(() => setNavigating(false), 15_000);
  navListeners.forEach((fn) => fn());
}
const onNavChange = (fn: () => void) => {
  navListeners.add(fn);
  return () => void navListeners.delete(fn);
};

/** Mark the start of a navigation made in code (`router.push`). */
export function startNavigation() {
  setNavigating(true);
}

/** `router.push` that also shows the progress bar until the new page is in. */
export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (href: string) => {
      if (href !== window.location.pathname + window.location.search) startNavigation();
      router.push(href);
    },
    [router],
  );
}

/** Is a click on this element a same-app navigation the bar should follow? */
function linkTarget(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const a = (event.target as Element | null)?.closest?.("a[href]");
  if (!(a instanceof HTMLAnchorElement) || a.target === "_blank" || a.hasAttribute("download")) return false;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return url.pathname + url.search !== window.location.pathname + window.location.search;
}

// ── The bar ────────────────────────────────────────────────────────────────

const subscribe = (fn: () => void) => {
  const a = onBusyChange(fn);
  const b = onNavChange(fn);
  return () => {
    a();
    b();
  };
};
const working = () => navigating || busyRequests() > 0;

function Bar() {
  const active = useSyncExternalStore(subscribe, working, () => false);
  const pathname = usePathname();
  const search = useSearchParams();
  const [shown, setShown] = useState(false);
  const [width, setWidth] = useState(0);
  const timers = useRef<number[]>([]);

  // Clicks on links start a navigation; the new path arriving ends it.
  useEffect(() => {
    const onClick = (e: MouseEvent) => linkTarget(e) && setNavigating(true);
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  useEffect(() => {
    setNavigating(false);
  }, [pathname, search]);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    clear();
    if (active) {
      timers.current.push(
        window.setTimeout(() => {
          setShown(true);
          setWidth(18);
          timers.current.push(window.setTimeout(() => setWidth(85), 60));
        }, 120),
      );
    } else {
      timers.current.push(
        window.setTimeout(() => setWidth((w) => (w > 0 ? 100 : 0)), 0),
        window.setTimeout(() => {
          setShown(false);
          timers.current.push(window.setTimeout(() => setWidth(0), 250));
        }, 220),
      );
    }
    return clear;
  }, [active]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[2000] h-[3px] print:hidden"
      style={{ opacity: shown ? 1 : 0, transition: "opacity 250ms ease" }}
    >
      <div
        className="h-full rounded-r-full bg-primary"
        style={{
          width: `${width}%`,
          // Creeps towards 85% while working; snaps to the end when done.
          transition: width === 100 ? "width 200ms ease-out" : width === 85 ? "width 8s cubic-bezier(.1,.6,.2,1)" : "width 250ms ease-out",
        }}
      />
    </div>
  );
}

/** Mounted once per app, in its layout. Suspense: it reads the search params. */
export function ProgressBar() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
