"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Which action is running, so its button can show a spinner and refuse a
 * second click. Keyed: a list of rows can show the spinner on the one row
 * whose button was pressed. One action at a time per component.
 *
 *   const { busy, run } = useBusy();
 *   <SecondaryButton loading={busy === `reset:${u.id}`} onClick={() => run(`reset:${u.id}`, reset)} />
 */
export function useBusy() {
  const [busy, setBusy] = useState<string | null>(null);
  const running = useRef(false);
  const run = useCallback(async <T,>(key: string, work: () => Promise<T>): Promise<T | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    setBusy(key);
    try {
      return await work();
    } finally {
      running.current = false;
      setBusy(null);
    }
  }, []);
  return { busy, run };
}
