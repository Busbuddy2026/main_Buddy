"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useTransition, type ReactNode } from "react";
import { api, holdBusy } from "@/lib/api/client";
import { forgetAnswers } from "@/lib/api/use-api";
import type { AdminMe, AdminRole } from "@/lib/api/types";

/*
 * Admin console session.
 *
 * The httpOnly `gf_admin` cookie is the source of truth. The layout reads it
 * on the server and hands the signed-in profile down as `me`; signing in or
 * out calls the API and refreshes the route, so the server renders the new
 * state. Nothing about the session lives in browser storage.
 */

export type { AdminRole };

export const ROLE_LABEL: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super admin",
  TRANSPORT_MANAGER: "Transport manager",
  OFFICE_STAFF: "Office staff",
  VIEWER: "Viewer",
};

interface AdminSession {
  authed: boolean;
  user: AdminMe;
  /** VIEWER can read everything and change nothing. */
  canEdit: boolean;
  /** Throws ApiRequestError on bad credentials or rate limiting. */
  signIn: (username: string, password: string) => Promise<void>;
  /** Signing in or out: the console is being re-rendered. */
  refreshing: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AdminSession | null>(null);

/** Placeholder profile while signed out; never rendered in the console. */
const SIGNED_OUT: AdminMe = {
  id: "",
  name: "",
  firstName: "",
  initials: "",
  username: "",
  role: "VIEWER",
  roleTitle: "",
  school: { name: "School transport", phone: null },
};


export function AdminSessionProvider({ me, children }: { me: AdminMe | null; children: ReactNode }) {
  const router = useRouter();
  // Signing in or out re-renders the console on the server; this tracks that wait.
  const [refreshing, startRefresh] = useTransition();
  useEffect(() => (refreshing ? holdBusy() : undefined), [refreshing]);

  const value = useMemo<AdminSession>(
    () => ({
      authed: me !== null,
      user: me ?? SIGNED_OUT,
      canEdit: me !== null && me.role !== "VIEWER",
      refreshing,
      signIn: async (username, password) => {
        await api.post("/api/auth/admin/login", { username, password });
        startRefresh(() => router.refresh());
      },
      signOut: async () => {
        await api.post("/api/auth/admin/logout").catch(() => undefined);
        forgetAnswers();
        startRefresh(() => router.refresh());
      },
    }),
    [me, router, refreshing],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin(): AdminSession {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminSessionProvider>");
  return ctx;
}
