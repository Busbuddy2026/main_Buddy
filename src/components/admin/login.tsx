"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/transport/ui";
import { api, errorMessage } from "@/lib/api/client";
import { useAdmin } from "@/lib/transport/admin-store";

/** Seeded demo account (prisma/seed.ts), shown the way the two mobile apps do. */
const DEMO = { email: "transport@bvm.edu.in", password: "demo1234" } as const;

/**
 * Admin sign-in (README §3 — `admin.<domain>/login`).
 *
 * Email + password against POST /api/auth/admin/login, rate limited on the
 * server. "Forgot password" issues a single-use reset link; until an email
 * provider is wired, development builds show the link on screen.
 */
export function AdminLogin() {
  const { signIn, user } = useAdmin();
  const resetToken = useSearchParams().get("reset");
  const [mode, setMode] = useState<"signin" | "forgot" | "reset">(resetToken ? "reset" : "signin");
  const [email, setEmail] = useState<string>(DEMO.email);
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [devLink, setDevLink] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") return void run(() => signIn(email.trim(), password));
    if (mode === "forgot") {
      return void run(async () => {
        const res = await api.post<{ devResetToken?: string }>("/api/auth/admin/forgot", {
          email: email.trim(),
        });
        setNotice("If that email belongs to a staff account, a reset link is on its way.");
        setDevLink(res.devResetToken ? `/admin?reset=${res.devResetToken}` : "");
      });
    }
    return void run(async () => {
      await api.post("/api/auth/admin/reset", { token: resetToken, password });
      setPassword("");
      setMode("signin");
      setNotice("Password changed. Sign in with the new one.");
      window.history.replaceState(null, "", window.location.pathname);
    });
  };

  const ready =
    mode === "forgot" ? !!email.trim() : mode === "reset" ? password.length >= 8 : !!email.trim() && !!password;

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6 py-12">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-3">
          <Image
            src="/school-logo.png"
            alt=""
            width={44}
            height={44}
            className="size-11 rounded-full object-cover"
          />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-[-0.01em]">{user.school.name}</div>
            <div className="text-[11.5px] text-faint">Transport OS</div>
          </div>
        </div>

        <h1 className="mt-7 text-[26px] font-semibold tracking-[-0.025em]">
          {mode === "signin" ? "Sign in" : mode === "forgot" ? "Reset your password" : "Choose a new password"}
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted text-pretty">
          The transport console is limited to school staff. Parents and bus crew use their own
          apps.
        </p>

        <form onSubmit={submit} className="mt-6 rounded-card border border-line bg-surface p-6">
          {mode !== "reset" ? (
            <>
              <label htmlFor="admin-email" className="text-[10.5px] font-semibold tracking-[0.03em] text-faint">
                WORK EMAIL
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="transport@bvm.edu.in"
                className="mt-1.5 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-disabled focus:border-primary focus:shadow-[0_0_0_3px_rgba(26,115,232,0.14)]"
              />
            </>
          ) : null}

          {mode !== "forgot" ? (
            <>
              <label
                htmlFor="admin-password"
                className={`${mode === "reset" ? "" : "mt-4 "}block text-[10.5px] font-semibold tracking-[0.03em] text-faint`}
              >
                {mode === "reset" ? "NEW PASSWORD · 8+ CHARACTERS" : "PASSWORD"}
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-control border border-line bg-surface pr-2 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(26,115,232,0.14)]">
                <input
                  id="admin-password"
                  type={reveal ? "text" : "password"}
                  autoComplete={mode === "reset" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-disabled"
                />
                <button
                  type="button"
                  onClick={() => setReveal((r) => !r)}
                  aria-label={reveal ? "Hide password" : "Show password"}
                  className="grid size-7 shrink-0 place-items-center rounded-chip text-faint hover:bg-canvas"
                >
                  <Icon name={reveal ? "visibility_off" : "visibility"} size={17} />
                </button>
              </div>
            </>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="mt-3.5 rounded-control bg-critical-tint px-3 py-2.5 text-[12.5px] font-medium text-critical-text"
            >
              {error}
            </div>
          ) : null}

          {notice && !error ? (
            <div role="status" className="mt-3.5 rounded-control bg-success-tint px-3 py-2.5 text-[12.5px] font-medium text-success-text">
              {notice}
              {devLink ? (
                <a href={devLink} className="mt-1 block font-mono text-[11.5px] text-primary underline">
                  Open reset link (development only)
                </a>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!ready || busy}
            className="mt-5 w-full rounded-control py-[11px] text-[13.5px] font-semibold transition-colors disabled:cursor-not-allowed"
            style={
              !ready || busy
                ? { background: "#f1f3f4", color: "#a8aeb7" }
                : { background: "#1a73e8", color: "#fff" }
            }
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Set password"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "forgot" : "signin");
              setError("");
              setNotice("");
              setDevLink("");
            }}
            className="mt-3.5 w-full text-center text-[12px] text-faint hover:text-primary"
          >
            {mode === "signin" ? "Forgotten your password?" : "Back to sign in"}
          </button>
        </form>

        <div className="mt-4 rounded-card border border-dashed border-line px-4 py-3.5">
          <div className="text-[10.5px] font-semibold tracking-[0.04em] text-faint">
            DEMO CREDENTIALS
          </div>
          <div className="mt-1.5 font-mono text-[12.5px] text-ink-2">
            {DEMO.email}
            <span className="mx-1.5 text-disabled">/</span>
            {DEMO.password}
          </div>
        </div>
      </div>
    </div>
  );
}
