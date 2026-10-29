"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import { forgetAnswers } from "@/lib/api/use-api";
import type { ParentChild, ParentMe, ParentPrefs } from "@/lib/api/types";
import { usePersistentState } from "./persist";
import type { PreferenceId } from "./parent";

/*
 * Parent app session and preferences.
 *
 * The httpOnly `gf_parent` cookie is the source of truth: the layout reads it
 * on the server and passes the guardian's profile and children down as `me`.
 * Only the selected child is kept in browser storage, as a UI convenience so
 * a cold start opens on the same child.
 */

const STORAGE_KEY = "bvm.parent.ui.v2";

interface ParentSession {
  authed: boolean;
  /** Always true: the session is known at first paint. Kept for the shell. */
  hydrated: boolean;
  me: ParentMe | null;
  phone: string;
  children: ParentChild[];
  child: ParentChild;
  childFirst: string;
  prefs: ParentPrefs;
  /** Throws ApiRequestError when the number and password do not match. */
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectChild: (first: string) => void;
  togglePref: (id: PreferenceId) => void;
}

const Ctx = createContext<ParentSession | null>(null);

/** Shown only while signed out, so screens never read an undefined child. */
const NO_CHILD: ParentChild = {
  id: "", first: "", name: "", initial: "", cls: "", roll: "", bus: "", stop: "",
};

export function ParentSessionProvider({ me, children }: { me: ParentMe | null; children: ReactNode }) {
  const router = useRouter();
  const { state, setState, clear } = usePersistentState(STORAGE_KEY, { childFirst: "" });
  // Optimistic copy of the preferences; the server copy arrives with `me`.
  const [prefs, setPrefs] = useState<ParentPrefs | null>(null);

  const togglePref = useCallback(
    (id: PreferenceId) => {
      const current = prefs ?? me?.prefs;
      if (!current) return;
      const next = { ...current, [id]: !current[id] };
      setPrefs(next);
      api.patch("/api/parent/preferences", { [id]: next[id] }).catch(() => setPrefs(current));
    },
    [prefs, me],
  );

  const value = useMemo<ParentSession>(() => {
    const kids = me?.children ?? [];
    // A child removed from the roster between visits must not strand the app.
    const child = kids.find((c) => c.first === state.childFirst) ?? kids[0] ?? NO_CHILD;

    return {
      authed: me !== null,
      hydrated: true,
      me,
      phone: me?.phone ?? "",
      children: kids,
      child,
      childFirst: child.first,
      prefs: prefs ?? me?.prefs ?? { alerts: true, absence: true, digest: false },
      signIn: async (phone, password) => {
        await api.post("/api/auth/parent/login", { phone, password });
        router.refresh();
      },
      signOut: async () => {
        await api.post("/api/auth/parent/logout").catch(() => undefined);
        forgetAnswers();
        clear();
        router.refresh();
      },
      selectChild: (first: string) => setState({ childFirst: first }),
      togglePref,
    };
  }, [me, state, prefs, router, setState, clear, togglePref]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useParent(): ParentSession {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useParent must be used inside <ParentSessionProvider>");
  return ctx;
}
