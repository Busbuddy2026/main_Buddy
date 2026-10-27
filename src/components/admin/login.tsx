"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/transport/ui";
import { errorMessage } from "@/lib/api/client";
import { useAdmin } from "@/lib/transport/admin-store";

/**
 * Admin sign-in (README §3 — `admin.<domain>/login`).
 *
 * Username + password against POST /api/auth/admin/login, rate limited on
 * the server. There is no email reset yet: a super admin sets a new password
 * from Settings → Staff accounts.
 */
export function AdminLogin() {
  const { signIn, user } = useAdmin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(username.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const ready = !!username.trim() && !!password;

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
          Sign in
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted text-pretty">
          The transport console is limited to school staff. Parents and bus crew use their own
          apps.
        </p>

        <form onSubmit={(e) => void submit(e)} className="mt-6 rounded-card border border-line bg-surface p-6">
          <label htmlFor="admin-username" className="text-[10.5px] font-semibold tracking-[0.03em] text-faint">
            USERNAME
          </label>
          <input
            id="admin-username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            className="mt-1.5 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-disabled focus:border-primary focus:shadow-[0_0_0_3px_rgba(26,115,232,0.14)]"
          />

              <label
                htmlFor="admin-password"
                className="mt-4 block text-[10.5px] font-semibold tracking-[0.03em] text-faint"
              >
                PASSWORD
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-control border border-line bg-surface pr-2 focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(26,115,232,0.14)]">
                <input
                  id="admin-password"
                  type={reveal ? "text" : "password"}
                  autoComplete="current-password"
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

          {error ? (
            <div
              role="alert"
              className="mt-3.5 rounded-control bg-critical-tint px-3 py-2.5 text-[12.5px] font-medium text-critical-text"
            >
              {error}
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
            {busy ? "Please wait…" : "Sign in"}
          </button>

          <p className="mt-3.5 text-center text-[12px] text-faint">
            Forgotten your password? Ask your school&apos;s super admin to reset it.
          </p>
        </form>

      </div>
    </div>
  );
}
