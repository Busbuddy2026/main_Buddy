"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/transport/ui";
import { ADMIN_DEMO, useAdmin } from "@/lib/transport/admin-store";
import { SCHOOL } from "@/lib/transport/seed";

/**
 * Admin sign-in (README §3 — `admin.<domain>/login`).
 *
 * Production adds optional TOTP after the password step, a "forgot password"
 * flow with an emailed single-use token, and rate limiting. None of that is
 * here: this checks the demo credentials in the browser.
 */
export function AdminLogin() {
  const { signIn } = useAdmin();
  const [email, setEmail] = useState<string>(ADMIN_DEMO.email);
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim().toLowerCase() === ADMIN_DEMO.email && password === ADMIN_DEMO.password) {
      setError("");
      signIn(email.trim());
      return;
    }
    // Never leak whether an account exists (API.md, Errors).
    setError("Those details did not match. Check the demo credentials below.");
  };

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
            <div className="text-[15px] font-semibold tracking-[-0.01em]">{SCHOOL.name}</div>
            <div className="text-[11.5px] text-faint">{SCHOOL.product}</div>
          </div>
        </div>

        <h1 className="mt-7 text-[26px] font-semibold tracking-[-0.025em]">Sign in</h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted text-pretty">
          The transport console is limited to school staff. Parents and bus crew use their own
          apps.
        </p>

        <form onSubmit={submit} className="mt-6 rounded-card border border-line bg-surface p-6">
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
            disabled={!email.trim() || !password}
            className="mt-5 w-full rounded-control py-[11px] text-[13.5px] font-semibold transition-colors disabled:cursor-not-allowed"
            style={
              !email.trim() || !password
                ? { background: "#f1f3f4", color: "#a8aeb7" }
                : { background: "#1a73e8", color: "#fff" }
            }
          >
            Sign in
          </button>

          <div className="mt-3.5 text-center text-[12px] text-faint">
            Forgotten your password? Ask the school office to send a reset link.
          </div>
        </form>

        <div className="mt-4 rounded-card border border-dashed border-line px-4 py-3.5">
          <div className="text-[10.5px] font-semibold tracking-[0.04em] text-faint">
            DEMO CREDENTIALS
          </div>
          <div className="mt-1.5 font-mono text-[12.5px] text-ink-2">
            {ADMIN_DEMO.email}
            <span className="mx-1.5 text-disabled">/</span>
            {ADMIN_DEMO.password}
          </div>
        </div>
      </div>
    </div>
  );
}
