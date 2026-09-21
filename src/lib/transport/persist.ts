"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Session persistence for the two mobile apps.
 *
 * Both apps are installed to the home screen and opened cold: a tap on a push
 * alert, a shared link, or the OS killing the tab all start a fresh document.
 * Holding the session in React state alone means every one of those lands the
 * user back on the login screen, so the state is mirrored to localStorage and
 * read back on mount.
 *
 * This is still a demo gate, not authentication. When the real flows land
 * (README §4) the httpOnly `gf_parent` / `gf_crew` cookies become the source of
 * truth and this keeps only the non-sensitive UI state — selected child,
 * notification preferences, the in-progress trip.
 */

/** First paint must match the server, which has no localStorage. */
function read<T extends object>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<T>;
    if (!parsed || typeof parsed !== "object") return fallback;
    // Merged, not replaced, so a stored session written by an older build is
    // still usable after new fields are added.
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

/**
 * `useState` that survives a reload.
 *
 * Returns `hydrated: false` until the stored value has been read, so callers
 * can hold back the login screen instead of flashing it at a signed-in user.
 */
export function usePersistentState<T extends object>(key: string, initial: T) {
  const [state, setState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const initialRef = useRef(initial);

  useEffect(() => {
    setState(read(key, initialRef.current));
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Private mode and full quotas are not worth failing a trip over.
    }
  }, [key, state, hydrated]);

  // Logging out in one tab logs out the others.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      setState(e.newValue ? read(key, initialRef.current) : initialRef.current);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignored; the in-memory reset below is what the UI reacts to.
    }
    setState(initialRef.current);
  }, [key]);

  return { state, setState, hydrated, clear };
}
