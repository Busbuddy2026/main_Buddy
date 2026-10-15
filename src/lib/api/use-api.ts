"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "./client";

/**
 * GET a path and keep the result. `reload()` fetches again; a null path waits.
 * Data is tagged with the path it came from, so switching children never
 * shows the previous child's numbers, while a reload of the same path keeps
 * the old data on screen until the new data lands.
 */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string }>({
    path: null,
    data: null,
    error: "",
  });

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const data = await api.get<T>(path);
      setState({ path, data, error: "" });
    } catch (err) {
      setState((s) => ({ path, data: s.path === path ? s.data : null, error: errorMessage(err) }));
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const current = state.path === path;
  return {
    data: current ? state.data : null,
    error: current ? state.error : "",
    loading: path !== null && !current,
    reload,
  };
}
