"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePersistentState } from "./persist";
import { CHILDREN, PARENT, type Child, type PreferenceId } from "./parent";

/*
 * Parent app session and preferences.
 *
 * This is a demo gate, not authentication. Real sign-in is mobile number + SMS
 * OTP against a provisioned Guardian, issuing an httpOnly `gf_parent` cookie
 * scoped to the parent subdomain (README §4, API.md /api/auth/parent/*).
 *
 * The session is persisted (see ./persist) so a reload, a push-alert deep link
 * or a cold start of the installed app resumes where the parent left off.
 */

type Prefs = Record<PreferenceId, boolean>;

const STORAGE_KEY = "bvm.parent.session.v1";

interface ParentState {
  authed: boolean;
  phone: string;
  childFirst: string;
  prefs: Prefs;
}

const INITIAL: ParentState = {
  authed: false,
  phone: PARENT.phone,
  childFirst: CHILDREN[0].first,
  prefs: { alerts: true, absence: true, digest: false },
};

interface ParentSession {
  authed: boolean;
  /** False until the stored session has been read; hold back the login screen. */
  hydrated: boolean;
  phone: string;
  child: Child;
  childFirst: string;
  prefs: Prefs;
  signIn: (phone: string) => void;
  signOut: () => void;
  selectChild: (first: string) => void;
  togglePref: (id: PreferenceId) => void;
}

const Ctx = createContext<ParentSession | null>(null);

export function ParentSessionProvider({ children }: { children: ReactNode }) {
  const { state, setState, hydrated, clear } = usePersistentState<ParentState>(
    STORAGE_KEY,
    INITIAL,
  );

  const value = useMemo<ParentSession>(() => {
    // A child removed from the roster between visits must not strand the app.
    const child = CHILDREN.find((c) => c.first === state.childFirst) ?? CHILDREN[0];

    return {
      authed: state.authed,
      hydrated,
      phone: state.phone,
      childFirst: child.first,
      child,
      prefs: state.prefs,
      signIn: (p: string) => setState((s) => ({ ...s, phone: p, authed: true })),
      signOut: clear,
      selectChild: (first: string) => setState((s) => ({ ...s, childFirst: first })),
      togglePref: (id) =>
        setState((s) => ({ ...s, prefs: { ...s.prefs, [id]: !s.prefs[id] } })),
    };
  }, [state, hydrated, setState, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useParent(): ParentSession {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useParent must be used inside <ParentSessionProvider>");
  return ctx;
}
