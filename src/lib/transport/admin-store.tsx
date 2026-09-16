"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { SCHOOL } from "./seed";

/*
 * Admin console session.
 *
 * This is a demo gate, not authentication. Real sign-in is email + password
 * (bcrypt, cost 12) with optional TOTP, rate limited 5 attempts per 15 minutes
 * per IP+email, issuing an httpOnly `gf_admin` cookie scoped to the admin
 * subdomain (README §4, API.md /api/auth/admin/login). Until that exists the
 * session lives in React state, so a refresh returns to the sign-in screen.
 */

/** Roles from docs/handoff/prisma/schema.prisma. */
export type AdminRole = "SUPER_ADMIN" | "TRANSPORT_MANAGER" | "OFFICE_STAFF" | "VIEWER";

export const ROLE_LABEL: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super admin",
  TRANSPORT_MANAGER: "Transport manager",
  OFFICE_STAFF: "Office staff",
  VIEWER: "Viewer",
};

/** Demo credentials, shown on the sign-in screen the way the two mobile apps do. */
export const ADMIN_DEMO = {
  email: "transport@bvm.edu.in",
  password: "demo1234",
} as const;

interface AdminUser {
  name: string;
  initials: string;
  email: string;
  role: AdminRole;
}

interface AdminSession {
  authed: boolean;
  user: AdminUser;
  signIn: (email: string) => void;
  signOut: () => void;
}

const Ctx = createContext<AdminSession | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState<string>(ADMIN_DEMO.email);

  const value = useMemo<AdminSession>(
    () => ({
      authed,
      user: {
        name: SCHOOL.user,
        initials: SCHOOL.userInitials,
        email,
        role: "TRANSPORT_MANAGER",
      },
      signIn: (e: string) => {
        setEmail(e);
        setAuthed(true);
      },
      signOut: () => setAuthed(false),
    }),
    [authed, email],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin(): AdminSession {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminSessionProvider>");
  return ctx;
}
