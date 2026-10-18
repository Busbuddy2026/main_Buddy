"use client";

import Image from "next/image";
import { useState } from "react";
import { CodeInput } from "@/components/mobile/code-input";
import { Keypad } from "@/components/mobile/keypad";
import { Icon } from "@/components/transport/ui";
import { errorMessage } from "@/lib/api/client";
import { CREW_ID_PREFIX } from "@/lib/api/schemas/crew";
import { useCrew } from "@/lib/transport/crew-store";

/** Crew IDs are a role prefix plus four digits (GF-ATT-0142, GF-DRV-0101). */
const PREFIX = { attendant: CREW_ID_PREFIX.ATTENDANT, driver: CREW_ID_PREFIX.DRIVER } as const;
type Role = keyof typeof PREFIX;

/**
 * C1 — crew ID, then a 4-digit PIN, checked on the server. Five wrong PINs
 * lock the ID for 15 minutes.
 */
export function CrewLogin() {
  const { signIn } = useCrew();
  const [step, setStep] = useState<"id" | "pin">("id");
  const [role, setRole] = useState<Role>("attendant");
  // The keypad types digits only; the role switch supplies the prefix.
  const [digits, setDigits] = useState("");
  const crewId = PREFIX[role] + digits;
  // Typed on the keypad below, or filled by autofill, paste or a keyboard.
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const idReady = digits.length === 4;
  const pinReady = pin.length === 4;

  /** One place the PIN is checked, whatever filled it in. */
  const verify = async (code: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await signIn(crewId, code);
    } catch (err) {
      // Wrong PIN shows the error border and clears, per C1.
      setError(true);
      setMessage(errorMessage(err));
      setPin("");
      setBusy(false);
    }
  };

  const submit = () => {
    if (step === "id") {
      if (!idReady) return;
      setStep("pin");
      setPin("");
      setError(false);
      setMessage("");
      return;
    }
    void verify(pin);
  };

  const press = (key: string) => {
    if (step === "id") {
      if (key === "back") return setDigits((v) => v.slice(0, -1));
      if (digits.length >= 4) return;
      return setDigits((v) => v + key);
    }
    if (key === "back") {
      setError(false);
      return setPin((v) => v.slice(0, -1));
    }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    setError(false);
    // Four digits is the whole PIN, so verify without waiting for the button.
    if (next.length === 4) void verify(next);
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
        {step === "id" ? "Crew sign in" : "Enter your 4-digit PIN"}
      </h1>
      <p className="mt-1.5 text-[clamp(12px,1.75vh,13px)] leading-[1.45] text-muted text-pretty">
        {step === "id"
          ? "Mark boarding and drops for the bus assigned to you today."
          : `Signing in as ${crewId}.`}
      </p>

      {step === "id" ? (
        <>
          <div className="mt-[clamp(10px,2.4vh,18px)] grid grid-cols-2 gap-[5px] rounded-xl bg-neutral-tint p-1">
            {(["attendant", "driver"] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                onClick={() => setRole(r)}
                className="rounded-[9px] py-2 text-center text-[13px] font-semibold capitalize"
                style={{ background: role === r ? "#16181b" : "transparent", color: role === r ? "#fff" : "#5f6672" }}
              >
                {r}
              </button>
            ))}
          </div>
          <div
            className="mt-2.5 rounded-2xl border px-4 py-[clamp(10px,1.9vh,15px)]"
            style={{ borderColor: idReady ? "#16181b" : "#e4e7eb" }}
          >
            <div className="text-[10.5px] tracking-[0.05em] text-faint">CREW ID</div>
            <div aria-label="Crew ID" className="mt-[3px] font-mono text-[19px] font-semibold tracking-[0.1em]">
              <span className="text-muted">{PREFIX[role]}</span>
              <span style={{ color: digits ? "#16181b" : "#a8aeb7" }}>{digits.padEnd(4, "•")}</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2.5 rounded-[14px] bg-canvas px-[15px] py-[11px] [@media(max-height:560px)]:hidden">
            <Icon name="info" size={19} className="text-faint" />
            <p className="text-xs leading-[1.45] text-muted">
              Your crew ID is printed on your school transport badge.
            </p>
          </div>
        </>
      ) : (
        <>
          <CodeInput
            className="mt-[clamp(12px,2.6vh,26px)]"
            length={4}
            value={pin}
            onChange={(v) => {
              setPin(v);
              setError(false);
            }}
            onComplete={(code) => void verify(code)}
            masked
            error={error}
            label="4-digit PIN"
            autoComplete="current-password"
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="font-mono text-[11.5px] text-faint">{crewId}</span>
            <button
              type="button"
              onClick={() => {
                setStep("id");
                setPin("");
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
              {message || "Wrong PIN."}
            </div>
          ) : null}
        </>
      )}

      <Keypad onPress={press} />

      <button
        type="button"
        onClick={submit}
        className="mt-[clamp(10px,1.8vh,18px)] min-h-[clamp(44px,6.5vh,54px)] shrink-0 rounded-[15px] py-[clamp(12px,2.1vh,17px)] text-[15px] font-bold tracking-[0.01em]"
        style={{
          background: (step === "id" ? idReady : pinReady) ? "#1a73e8" : "#f1f3f4",
          color: (step === "id" ? idReady : pinReady) ? "#fff" : "#8b919b",
        }}
      >
        {step === "id" ? "Continue" : "SIGN IN"}
      </button>
    </div>
  );
}
