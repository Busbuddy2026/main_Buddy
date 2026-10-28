"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Card, Icon, PrimaryButton, SecondaryButton } from "@/components/transport/ui";
import { api, errorMessage, holdBusy } from "@/lib/api/client";

/**
 * The analytics PIN screen. Nothing under Analytics renders until the PIN is
 * right; the server checks the same unlock on every analytics request.
 */
export function AnalyticsPinGate() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [opening, startOpening] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => (opening ? holdBusy() : undefined), [opening]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4 || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/api/admin/analytics/unlock", { pin });
      startOpening(() => router.refresh());
    } catch (err) {
      setError(errorMessage(err));
      setPin("");
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="w-full max-w-[380px] px-7 py-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary-tint">
          <Icon name="lock" size={24} className="text-primary" />
        </span>
        <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.01em]">Analytics is locked</h2>
        <p className="mt-1 text-[12.5px] text-muted">Enter the analytics PIN to open fuel, cost, safety and punctuality reports.</p>
        <form onSubmit={(e) => void submit(e)} className="mt-5">
          <label htmlFor="analytics-pin" className="sr-only">
            Analytics PIN
          </label>
          <input
            ref={input}
            id="analytics-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              setError("");
            }}
            placeholder="••••••"
            className={`w-full rounded-control border bg-surface px-3 py-3 text-center font-mono text-[22px] tracking-[0.5em] text-ink outline-none placeholder:text-disabled focus:border-primary ${error ? "border-critical" : "border-line"}`}
          />
          {error ? (
            <div role="alert" className="mt-2 text-[12px] font-medium text-critical-text">
              {error}
            </div>
          ) : null}
          <PrimaryButton type="submit" icon="lock_open" loading={busy || opening} disabled={pin.length < 4} className="mt-4 w-full justify-center">
            {busy || opening ? "Opening…" : "Unlock"}
          </PrimaryButton>
        </form>
        <p className="mt-4 text-[11px] text-faint">Stays open for 30 minutes on this sign-in. Wrong attempts are logged.</p>
      </Card>
    </div>
  );
}

/** Close Analytics again before the 30 minutes are up. */
export function AnalyticsLockButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <SecondaryButton
      icon="lock"
      loading={busy}
      className="!py-1.5 !text-[12px]"
      onClick={async () => {
        setBusy(true);
        await api.post("/api/admin/analytics/lock").catch(() => undefined);
        router.refresh();
        setBusy(false);
      }}
    >
      Lock analytics
    </SecondaryButton>
  );
}
