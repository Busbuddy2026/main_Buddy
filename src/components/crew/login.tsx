"use client";

import Image from "next/image";
import { useState } from "react";
import { Keypad } from "@/components/mobile/keypad";
import { Icon } from "@/components/transport/ui";
import { CREW } from "@/lib/transport/crew";
import { useCrew } from "@/lib/transport/crew-store";

/** C1 — crew ID, then a 4-digit PIN. Demo PIN is 1234. */
export function CrewLogin() {
  const { signIn } = useCrew();
  const [step, setStep] = useState<"id" | "pin">("id");
  const [crewId, setCrewId] = useState<string>(CREW.crewId);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const idReady = crewId.length >= 8;
  const pinReady = pin.length === 4;

  const submit = () => {
    if (step === "id") {
      if (!idReady) return;
      setStep("pin");
      setPin("");
      setError(false);
      return;
    }
    if (pin === CREW.demoPin) signIn(crewId);
    else setError(true);
  };

  const press = (key: string) => {
    if (step === "id") {
      if (key === "back") return setCrewId((v) => v.slice(0, -1));
      if (crewId.length >= 12) return;
      return setCrewId((v) => v + key);
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
    if (next.length === 4) {
      if (next === CREW.demoPin) signIn(crewId);
      // Wrong PIN shows the error border and clears, per C1.
      else {
        setError(true);
        setPin("");
      }
    }
  };

  return (
    <div className="flex min-h-[700px] flex-col px-[26px] pb-[22px] pt-[38px]">
      <Image
        src="/school-logo.png"
        alt=""
        width={76}
        height={76}
        className="size-[76px] rounded-full object-cover"
      />
      <h1 className="mt-4 text-[25px] font-semibold tracking-[-0.025em]">
        {step === "id" ? "Crew sign in" : "Enter your 4-digit PIN"}
      </h1>
      <p className="mt-1.5 text-[13px] leading-[1.5] text-muted text-pretty">
        {step === "id"
          ? "Mark boarding and drops for the bus assigned to you today."
          : `Signing in as ${CREW.name}. Demo PIN is ${CREW.demoPin}.`}
      </p>

      {step === "id" ? (
        <>
          <div
            className="mt-6 rounded-2xl border px-4 py-[15px]"
            style={{ borderColor: idReady ? "#16181b" : "#e4e7eb" }}
          >
            <div className="text-[10.5px] tracking-[0.05em] text-faint">CREW ID</div>
            <div
              className="mt-[3px] font-mono text-[19px] font-semibold tracking-[0.1em]"
              style={{ color: crewId ? "#16181b" : "#a8aeb7" }}
            >
              {crewId || "GF-ATT-••••"}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2.5 rounded-[14px] bg-canvas px-[15px] py-[13px]">
            <Icon name="info" size={19} className="text-faint" />
            <p className="text-xs leading-[1.45] text-muted">
              Your crew ID is printed on your school transport badge.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="mt-[26px] flex gap-[11px]">
            {Array.from({ length: 4 }, (_, i) => {
              const filled = i < pin.length;
              return (
                <div
                  key={i}
                  className="grid flex-1 place-items-center rounded-[14px] border-[1.5px]"
                  style={{
                    aspectRatio: "1 / 1.1",
                    borderColor: error ? "#f7c8c4" : filled ? "#16181b" : "#e4e7eb",
                    background: filled ? "#f6f7f9" : "#fff",
                  }}
                >
                  <span
                    className="size-[13px] rounded-full"
                    style={{ background: filled ? "#16181b" : "#e4e7eb" }}
                  />
                </div>
              );
            })}
          </div>
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
              Wrong PIN. Demo PIN is 1 2 3 4.
            </div>
          ) : null}
        </>
      )}

      <Keypad onPress={press} />

      <button
        type="button"
        onClick={submit}
        className="mt-[18px] rounded-[15px] py-[17px] text-[15px] font-bold tracking-[0.01em]"
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
