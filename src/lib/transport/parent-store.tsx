"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { CHILDREN, PARENT, type Child, type PreferenceId } from "./parent";

/*
 * Parent app session and preferences.
 *
 * This is a demo gate, not authentication. Real sign-in is mobile number + SMS
 * OTP against a provisioned Guardian, issuing an httpOnly `gf_parent` cookie
 * scoped to the parent subdomain (README §4, API.md /api/auth/parent/*). Until
 * that exists the session lives in React state, so a refresh returns to login.
 */

type Prefs = Record<PreferenceId, boolean>;

interface ParentSession {
  authed: boolean;
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
  const [authed, setAuthed] = useState(false);
  const [phone, setPhone] = useState<string>(PARENT.phone);
  const [childFirst, setChildFirst] = useState(CHILDREN[0].first);
  const [prefs, setPrefs] = useState<Prefs>({ alerts: true, absence: true, digest: false });

  const value = useMemo<ParentSession>(
    () => ({
      authed,
      phone,
      childFirst,
      child: CHILDREN.find((c) => c.first === childFirst) ?? CHILDREN[0],
      prefs,
      signIn: (p: string) => {
        setPhone(p);
        setAuthed(true);
      },
      signOut: () => setAuthed(false),
      selectChild: setChildFirst,
      togglePref: (id) => setPrefs((s) => ({ ...s, [id]: !s[id] })),
    }),
    [authed, phone, childFirst, prefs],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useParent(): ParentSession {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useParent must be used inside <ParentSessionProvider>");
  return ctx;
}
