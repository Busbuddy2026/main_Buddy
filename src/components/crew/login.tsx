"use client";

import Image from "next/image";
import { useState } from "react";
import { Keypad } from "@/components/mobile/keypad";
import { Icon } from "@/components/transport/ui";
import { errorMessage } from "@/lib/api/client";
import { CREW_LOGIN_PREFIX, CREW_ROLE_LETTER } from "@/lib/api/schemas/crew";
import { useCrew } from "@/lib/transport/crew-store";

const MAX_DIGITS = 6;

/**
 * C1 — the crew ID (BMV, A for attendant or D for driver, then the bus number
 * on the keypad: BMVA5965), then the
 * crew password the school gives all its drivers and attendants, checked on
 * the server. Five wrong tries lock the ID for 15 minutes.
 */
export function CrewLogin() {
  const { signIn } = useCrew();
  const [step, setStep] = useState<"id" | "password">("id");
  const [role, setRole] = useState<keyof typeof CREW_ROLE_LETTER>("ATTENDANT");
  // The keypad types the bus number; the switch supplies A or D.
  const [digits, setDigits] = useState("");
  const prefix = CREW_LOGIN_PREFIX + CREW_ROLE_LETTER[role];
  const crewId = prefix + digits;
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const idReady = digits.length > 0;
  const passwordReady = password.length > 0;

  const verify = async () => {
    if (busy || !passwordReady) return;
    setBusy(true);
    try {
      await signIn(crewId, password);
    } catch (err) {
      setError(true);
      setMessage(errorMessage(err));
      setBusy(false);
    }
  };

  const submit = () => {
    if (step === "id") {
      if (!idReady) return;
      setStep("password");
      setPassword("");
      setError(false);
      setMessage("");
      return;
    }
    void verify();
  };

  const press = (key: string) => {
    if (key === "back") return setDigits((v) => v.slice(0, -1));
    if (digits.length >= MAX_DIGITS) return;
    setDigits((v) => v + key);
  };

  return (
    <div className="flex min-h-full flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+clamp(10px,2vh,22px))] pt-[clamp(12px,4vh,38px)] sm:px-[26px]">
      <Image
        src="/school-logo.png"
        alt=""
        width={76}
        height={76}
        className="size-[clamp(46px,10vh,76px)] shrink-0 rounded-full object-cover"
      />
      <h1 className="mt-[clamp(8px,2.2vh,16px)] text-[clamp(19px,3.6vh,25px)] font-semibold tracking-[-0.025em] text-balance">
        {step === "id" ? "Crew sign in" : "Enter the crew password"}
      </h1>
      <p className="mt-1.5 text-[clamp(12px,1.75vh,13px)] leading-[1.45] text-muted text-pretty">
        {step === "id"
          ? "Mark boarding and drops for your bus."
          : `Signing in as ${crewId}.`}
      </p>

      {step === "id" ? (
        <>
          <div className="mt-[clamp(10px,2.4vh,18px)] grid grid-cols-2 gap-[5px] rounded-xl bg-neutral-tint p-1">
            {(["ATTENDANT", "DRIVER"] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                onClick={() => setRole(r)}
                className="rounded-[9px] py-2 text-center text-[13px] font-semibold"
                style={{ background: role === r ? "#16181b" : "transparent", color: role === r ? "#fff" : "#5f6672" }}
              >
                {r === "ATTENDANT" ? "Attendant" : "Driver"}
              </button>
            ))}
          </div>
          <div
            className="mt-2.5 rounded-2xl border px-4 py-[clamp(10px,1.9vh,15px)]"
            style={{ borderColor: idReady ? "#16181b" : "#e4e7eb" }}
          >
            <div className="text-[10.5px] tracking-[0.05em] text-faint">CREW ID</div>
            <div aria-label="Crew ID" className="mt-[3px] font-mono text-[22px] font-semibold tracking-[0.08em]">
              <span className="text-muted">{prefix}</span>
              <span style={{ color: digits ? "#16181b" : "#a8aeb7" }}>{digits || "5965"}</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2.5 rounded-[14px] bg-canvas px-[15px] py-[11px] [@media(max-height:560px)]:hidden">
            <Icon name="info" size={19} className="text-faint" />
            <p className="text-xs leading-[1.45] text-muted">
              Type your bus number. For Bus 5965: attendant <span className="font-mono font-semibold text-ink">{CREW_LOGIN_PREFIX}A5965</span>, driver{" "}
              <span className="font-mono font-semibold text-ink">{CREW_LOGIN_PREFIX}D5965</span>.
            </p>
          </div>
        </>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
            className="mt-[clamp(12px,2.6vh,26px)]"
          >
            <label htmlFor="crew-password" className="mb-1.5 block text-[12px] font-semibold text-ink-2">
              Password
            </label>
            <div
              className="flex items-center gap-3 rounded-2xl border px-4 py-[clamp(10px,1.8vh,14px)] focus-within:border-primary"
              style={{ borderColor: error ? "#d93025" : "#e4e7eb" }}
            >
              <Icon name="lock" size={19} className="text-faint" />
              <input
                id="crew-password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                placeholder="Crew password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-disabled"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                className="grid size-8 place-items-center rounded-full text-faint hover:bg-[#f1f3f4]"
              >
                <Icon name={show ? "visibility_off" : "visibility"} size={19} />
              </button>
            </div>
            <p className="mt-1.5 text-[11.5px] text-faint">The transport office gives the crew password.</p>
          </form>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="font-mono text-[11.5px] text-faint">{crewId}</span>
            <button
              type="button"
              onClick={() => {
                setStep("id");
                setPassword("");
                setError(false);
              }}
              className="text-xs font-semibold text-primary"
            >
              Not you?
            </button>
          </div>
          {error ? (
            <div
              role="alert"
              className="mt-3 rounded-xl bg-critical-tint px-[13px] py-[11px] text-[12.5px] font-medium text-critical-text"
            >
              {message || "Wrong password."}
            </div>
          ) : null}
        </>
      )}

      {step === "id" ? <Keypad onPress={press} /> : <div className="flex-1" />}

      <button
        type="button"
        onClick={submit}
        className="mt-[clamp(10px,1.8vh,18px)] min-h-[clamp(44px,6.5vh,54px)] shrink-0 rounded-[15px] py-[clamp(12px,2.1vh,17px)] text-[15px] font-bold tracking-[0.01em]"
        style={{
          background: (step === "id" ? idReady : passwordReady) ? "#1a73e8" : "#f1f3f4",
          color: (step === "id" ? idReady : passwordReady) ? "#fff" : "#8b919b",
        }}
      >
        {step === "id" ? "Continue" : busy ? "Signing in…" : "Sign in"}
      </button>
    </div>
  );
}
