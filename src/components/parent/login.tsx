"use client";

import Image from "next/image";
import { useState } from "react";
import { CodeInput } from "@/components/mobile/code-input";
import { Keypad } from "@/components/mobile/keypad";
import { PARENT, formatPhone } from "@/lib/transport/parent";
import { useParent } from "@/lib/transport/parent-store";

/** B1 — mobile number, then a 6-digit OTP. Demo code is 123456. */
export function ParentLogin() {
  const { signIn } = useParent();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState<string>(PARENT.phone);
  // Prefilled with the demo code so signing in is one tap; the field still
  // accepts OS autofill, paste, a hardware keyboard and the keypad below.
  const [otp, setOtp] = useState<string>(PARENT.demoOtp);
  const [error, setError] = useState(false);

  const phoneReady = phone.length === 10;
  const otpReady = otp.length === 6;
  const display = step === "phone" && phone.length === 0 ? "Mobile number" : formatPhone(phone);

  /** One place the code is checked, whatever filled it in. */
  const verify = (code: string) => {
    if (code === PARENT.demoOtp) signIn(phone);
    else setError(true);
  };

  const submit = () => {
    if (step === "phone") {
      if (!phoneReady) return;
      setStep("otp");
      setOtp(PARENT.demoOtp);
      setError(false);
      return;
    }
    verify(otp);
  };

  const press = (key: string) => {
    if (step === "phone") {
      if (key === "back") return setPhone((p) => p.slice(0, -1));
      if (phone.length >= 10) return;
      return setPhone((p) => p + key);
    }
    if (key === "back") {
      setError(false);
      return setOtp((p) => p.slice(0, -1));
    }
    if (otp.length >= 6) return;
    const next = otp + key;
    setOtp(next);
    setError(false);
    // Six digits is the whole code, so verify without waiting for the button.
    if (next.length === 6) verify(next);
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
        {step === "phone" ? "Bharath Vidya Mandir" : "Enter the 6-digit code"}
      </h1>
      <p className="mt-1.5 text-[clamp(12px,1.75vh,13px)] leading-[1.45] text-muted text-pretty">
        {step === "phone"
          ? "Track your child’s bus, get boarding alerts and report transport absences."
          : `Sent to +91 ${formatPhone(phone)}. For this demo the code is ${PARENT.demoOtp}.`}
      </p>

      {step === "phone" ? (
        <>
          <div
            className="mt-[clamp(12px,3.4vh,24px)] flex items-center gap-3 rounded-2xl border px-4 py-[clamp(10px,1.8vh,14px)]"
            style={{ borderColor: phoneReady ? "#1a73e8" : "#e4e7eb" }}
          >
            <span className="font-mono text-[15px] font-semibold text-muted">+91</span>
            <span className="h-5 w-px bg-line" />
            <span
              className="flex-1 font-mono text-lg font-semibold tracking-[0.06em]"
              style={{ color: phone.length ? "#16181b" : "#a8aeb7" }}
            >
              {display}
            </span>
          </div>
          <p className="mt-2 text-[11.5px] text-faint [@media(max-height:540px)]:hidden">
            Use the mobile number registered with the school.
          </p>
        </>
      ) : (
        <>
          <CodeInput
            className="mt-[clamp(12px,3.4vh,24px)]"
            length={6}
            value={otp}
            onChange={(v) => {
              setOtp(v);
              setError(false);
            }}
            onComplete={verify}
            error={error}
            label="One-time code"
            autoComplete="one-time-code"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11.5px] text-faint">Resend code in 0:24</span>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setOtp(PARENT.demoOtp);
                setError(false);
              }}
              className="text-xs font-semibold text-primary"
            >
              Change number
            </button>
          </div>
          {error ? (
            <div
              role="alert"
              className="mt-3 rounded-xl bg-critical-tint px-[13px] py-[11px] text-[12.5px] font-medium text-critical-text"
            >
              That code did not match. Try 1 2 3 4 5 6.
            </div>
          ) : null}
        </>
      )}

      <Keypad onPress={press} />

      <button
        type="button"
        onClick={submit}
        className="mt-[clamp(10px,1.8vh,18px)] min-h-[clamp(44px,6.5vh,54px)] shrink-0 rounded-[15px] py-[clamp(11px,2vh,16px)] text-[15px] font-semibold"
        style={{
          background: (step === "phone" ? phoneReady : otpReady) ? "#1a73e8" : "#f1f3f4",
          color: (step === "phone" ? phoneReady : otpReady) ? "#fff" : "#8b919b",
        }}
      >
        {step === "phone" ? "Send OTP" : "Verify and sign in"}
      </button>
      <p className="mt-[clamp(6px,1.4vh,14px)] text-center text-[11px] leading-[1.4] text-disabled [@media(max-height:560px)]:hidden">
        Only parents and guardians listed in school records can sign in.
      </p>
    </div>
  );
}
