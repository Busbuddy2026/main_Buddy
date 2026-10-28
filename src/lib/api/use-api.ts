"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "./client";

/**
 * The last answer per path, kept for this browser tab: coming back to a
 * screen shows it at once while a fresh copy loads. Small and bounded.
 */
const lastAnswer = new Map<string, unknown>();
const remember = (path: string, data: unknown) => {
  lastAnswer.delete(path);
  lastAnswer.set(path, data);
  if (lastAnswer.size > 60) lastAnswer.delete(lastAnswer.keys().next().value!);
};

/** Drop every remembered answer: on sign-out, so the next person sees nothing of the last. */
export const forgetAnswers = () => lastAnswer.clear();

/**
 * GET a path and keep the result. `reload()` fetches again; a null path waits.
 * Data is tagged with the path it came from, so switching children never
 * shows the previous child's numbers, while a reload of the same path keeps
 * the old data on screen until the new data lands. A first load (nothing to
 * show yet) shows the page's progress bar; refreshes stay quiet.
 */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string }>(() => ({
    path: path && lastAnswer.has(path) ? path : null,
    data: path && lastAnswer.has(path) ? (lastAnswer.get(path) as T) : null,
    error: "",
  }));

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const data = await api.get<T>(path, { busy: !lastAnswer.has(path) });
      remember(path, data);
      setState({ path, data, error: "" });
    } catch (err) {
      setState((s) => ({ path, data: s.path === path ? s.data : null, error: errorMessage(err) }));
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const current = state.path === path;
  // Switched to a path seen before: show its last answer while the new one loads.
  const remembered = !current && path && lastAnswer.has(path) ? (lastAnswer.get(path) as T) : null;
  return {
    data: current ? state.data : remembered,
    error: current ? state.error : "",
    loading: path !== null && !current,
    reload,
  };
}
