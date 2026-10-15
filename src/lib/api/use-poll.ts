"use client";

import { useEffect, useRef } from "react";

/**
 * Re-run `load` every `ms` while the tab is visible, and again when it comes
 * back into view. Stands in for realtime until the GPS feed lands; screens
 * that show live attendance use it.
 */
export function usePoll(load: () => Promise<unknown> | void, ms = 15_000): void {
  const fn = useRef(load);
  useEffect(() => {
    fn.current = load;
  }, [load]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void fn.current();
    };
    tick();
    const timer = window.setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [ms]);
}
